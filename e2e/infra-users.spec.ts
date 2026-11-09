import { test, expect } from './fixtures';
import { gotoHydrated, waitForHydration } from './helpers';
import { linkIn, waitForMail } from './fixtures/mail';
import type { Page } from '@playwright/test';

// Infra admins managing user accounts from /infra/users/[id].

async function action(page: Page, name: string) {
	await page.getByRole('button', { name: /^Actions/ }).click();
	await page.getByRole('menuitem', { name }).click();
}

const dialog = (page: Page) => page.getByRole('dialog');

test('editing a user’s details', async ({ world, db }) => {
	const user = await world.createUser();
	const { page } = await world.admin();

	await gotoHydrated(page, `/infra/users/${user.id}`);
	await action(page, 'Edit details');
	await dialog(page).getByLabel('Name', { exact: true }).fill('Renamed Person');
	await dialog(page).getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Details saved.')).toBeVisible();

	const { rows } = await db.query(`SELECT name FROM auth."user" WHERE id = $1`, [user.id]);
	expect(rows[0].name).toBe('Renamed Person');
});

test('a suspended user cannot sign in until the suspension is lifted', async ({ world }) => {
	const user = await world.createUser();
	const { page } = await world.admin();

	await gotoHydrated(page, `/infra/users/${user.id}`);
	await action(page, 'Suspend');
	await dialog(page).getByLabel('Reason').fill('Spam');
	await dialog(page).getByRole('button', { name: 'Suspend' }).click();
	await expect(page.getByText(/suspended/i).first()).toBeVisible();
	await expect(world.signIn(user)).rejects.toThrow();

	await action(page, 'Lift suspension');
	await dialog(page).getByRole('button', { name: 'Lift suspension' }).click();
	await expect(world.signIn(user)).resolves.toBeTruthy();
});

test('impersonating a user shows the banner, closes the panel, audits changes, and stops back on their page', async ({
	world,
	db
}) => {
	const org = await world.createOrg();
	const target = await world.createUser();
	await world.addMember(org, target, { role: 'Administrator' });
	const { page } = await world.admin();

	await gotoHydrated(page, `/infra/users/${target.id}`);
	await action(page, 'Impersonate');
	await dialog(page).getByRole('button', { name: 'Impersonate' }).click();
	await page.waitForURL((url) => !url.pathname.startsWith('/infra'));
	await waitForHydration(page);
	await expect(page.getByText('You are signed in as')).toBeVisible();

	expect((await page.goto('/infra'))?.status()).toBe(403);

	// A change made while impersonating is recorded against the admin.
	const res = await page.request.post(`/api/v1/organizations/${org.id}/roles`, {
		data: { name: 'Made while impersonating' },
		headers: { origin: world.baseURL }
	});
	expect(res.status()).toBe(201);
	const { rows } = await db.query(
		`SELECT count(*)::int AS n FROM infra_audit_log WHERE action = 'impersonation.request' AND target_id = $1`,
		[target.id]
	);
	expect(rows[0].n).toBeGreaterThan(0);

	await gotoHydrated(page, '/orgs');
	await page.getByRole('button', { name: 'Stop impersonating' }).click();
	await expect(page).toHaveURL(new RegExp(`/infra/users/${target.id}`));
});

test('sessions: signing a user out everywhere ends their sessions', async ({ world, db }) => {
	const user = await world.createUser();
	await world.signIn(user);
	const { page } = await world.admin();

	await gotoHydrated(page, `/infra/users/${user.id}?tab=sessions`);
	await action(page, 'Sign out everywhere');
	await dialog(page).getByRole('button', { name: 'Sign out' }).click();

	await expect
		.poll(
			async () =>
				(
					await db.query(`SELECT count(*)::int AS n FROM auth.session WHERE user_id = $1`, [
						user.id
					])
				).rows[0].n
		)
		.toBe(0);
});

test('a password reset and a verification email reach the user', async ({ world }) => {
	const user = await world.createUser({ verified: false });
	const { page } = await world.admin();

	await gotoHydrated(page, `/infra/users/${user.id}`);
	await action(page, 'Send password reset');
	await dialog(page).getByRole('button', { name: 'Send' }).click();
	const reset = await waitForMail(user.email, { subject: 'Reset your password' });
	expect(linkIn(reset, 'reset-password')).toBeTruthy();

	await action(page, 'Resend verification email');
	await dialog(page).getByRole('button', { name: 'Send' }).click();
	expect(
		linkIn(await waitForMail(user.email, { subject: 'Verify your email' }), 'verify-email')
	).toBeTruthy();

	await gotoHydrated(page, `/infra/users/${user.id}?tab=emails`);
	await expect(
		page.getByText('auth.reset_password').or(page.getByText(/reset/i)).first()
	).toBeVisible();
});

test('turning off a user’s two-factor sign-in', async ({ world, db }) => {
	const user = await world.createUser();
	await db.query(`UPDATE auth."user" SET two_factor_enabled = true WHERE id = $1`, [user.id]);
	await db.query(
		`INSERT INTO auth.two_factor (user_id, secret, backup_codes) VALUES ($1, 'x', 'y')`,
		[user.id]
	);
	const { page } = await world.admin();

	await gotoHydrated(page, `/infra/users/${user.id}`);
	await action(page, 'Turn off two-factor sign-in');
	await dialog(page).getByRole('button', { name: 'Turn off' }).click();

	await expect
		.poll(
			async () =>
				(await db.query(`SELECT two_factor_enabled FROM auth."user" WHERE id = $1`, [user.id]))
					.rows[0].two_factor_enabled
		)
		.toBe(false);
});

test('deleting an account needs the email typed', async ({ world, db }) => {
	const user = await world.createUser();
	const { page } = await world.admin();

	await gotoHydrated(page, `/infra/users/${user.id}`);
	await action(page, 'Delete account');
	await dialog(page).getByLabel(`Type ${user.email} to confirm`).fill(user.email);
	await dialog(page).getByRole('button', { name: 'Delete account' }).click();
	await expect(page).toHaveURL(/\/infra\/users$/);

	const { rows } = await db.query(
		`SELECT deleted_at IS NOT NULL AS deleted FROM auth."user" WHERE id = $1`,
		[user.id]
	);
	expect(rows[0]?.deleted ?? true).toBe(true);
	await expect(world.signIn(user)).rejects.toThrow();
});

test('the user page tabs open', async ({ world }) => {
	const org = await world.createOrg();
	const { page } = await world.admin();

	await gotoHydrated(page, `/infra/users/${org.owner.id}`);
	for (const tab of ['organizations', 'sessions', 'activity', 'emails', 'audit']) {
		const res = await page.goto(`/infra/users/${org.owner.id}?tab=${tab}`);
		expect(res?.status(), tab).toBe(200);
	}
	await gotoHydrated(page, `/infra/users/${org.owner.id}?tab=organizations`);
	await expect(page.getByText(org.name)).toBeVisible();
});

test('admins page: give a user an infra role and take it away', async ({ world, db }) => {
	const user = await world.createUser();
	const { page } = await world.admin();

	await gotoHydrated(page, '/infra/admins');
	await page.getByLabel('Find a user').fill(user.email);
	await page.getByRole('button', { name: 'Search' }).click();
	await page.getByRole('button', { name: `Choose ${user.name}` }).click();
	await page.getByLabel(`Role for ${user.name}`).selectOption({ index: 1 });
	await page.getByRole('button', { name: 'Give role' }).click();
	await expect(page.getByText('Role given.')).toBeVisible();
	const roles = async () =>
		(
			await db.query(
				`SELECT count(*)::int AS n FROM user_role_membership urm JOIN permission_role pr ON pr.id = urm.role_id
				 WHERE urm.user_id = $1 AND pr.scope = 'infrastructure'`,
				[user.id]
			)
		).rows[0].n;
	expect(await roles()).toBe(1);

	await gotoHydrated(page, '/infra/admins');
	await page.getByRole('button', { name: new RegExp(`from ${user.name}$`) }).click();
	await dialog(page).getByRole('button', { name: 'Remove role' }).click();
	await expect(page.getByText('Role removed.')).toBeVisible();
	expect(await roles()).toBe(0);
});
