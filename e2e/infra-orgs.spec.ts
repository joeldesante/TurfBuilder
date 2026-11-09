import { test, expect } from './fixtures';
import { gotoHydrated } from './helpers';
import type { Page } from '@playwright/test';

// Infra admins managing organizations from /infra/orgs.

async function action(page: Page, name: string) {
	await page.getByRole('button', { name: /^Actions/ }).click();
	await page.getByRole('menuitem', { name }).click();
}

function dialog(page: Page) {
	return page.getByRole('dialog');
}

test('the organizations list finds an org and opens it with its figures', async ({ world }) => {
	const org = await world.createOrg();
	const { page } = await world.admin();

	await gotoHydrated(page, `/infra/orgs?q=${encodeURIComponent(org.slug)}`);
	await page.getByRole('link', { name: org.name }).first().click();
	await expect(page).toHaveURL(new RegExp(`/infra/orgs/${org.id}`));
	await expect(page.getByRole('heading', { name: org.name })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Figures' })).toContainText('Members');

	for (const tab of ['Members', 'Invitations', 'Activity', 'Audit']) {
		// Scoped: the panel's sidebar has its own Members and Audit links.
		await page
			.getByLabel('Organization sections')
			.getByRole('link', { name: new RegExp(`^${tab}`) })
			.click();
		await expect(page).toHaveURL(new RegExp(`tab=${tab.toLowerCase()}`));
	}
});

test('suspending an org locks its members out until the suspension is lifted, and both are audited', async ({
	world,
	db
}) => {
	const org = await world.createOrg();
	const member = await world.as(org, 'organizer');
	const { page } = await world.admin();

	await gotoHydrated(page, `/infra/orgs/${org.id}`);
	await action(page, 'Suspend');
	await dialog(page).getByLabel('Reason').fill('Unpaid invoice');
	await dialog(page).getByRole('button', { name: 'Suspend' }).click();
	await expect(page.getByText('Organization suspended.')).toBeVisible();
	expect((await member.page.goto(`/o/${org.slug}/s`))?.status()).toBe(403);

	await action(page, 'Lift suspension');
	await dialog(page).getByRole('button', { name: 'Lift suspension' }).click();
	await expect(page.getByText('Suspension lifted.')).toBeVisible();
	expect((await member.page.goto(`/o/${org.slug}/s`))?.status()).toBe(200);

	const { rows } = await db.query(
		`SELECT action FROM infra_audit_log WHERE target_id = $1 ORDER BY created_at`,
		[org.id]
	);
	expect(rows.map((r) => r.action)).toEqual(
		expect.arrayContaining(['org.suspend', 'org.unsuspend'])
	);
});

test('deleting an org needs its slug typed, hides it, and restoring brings it back', async ({
	world
}) => {
	const org = await world.createOrg();
	const member = await world.as(org, 'volunteer');
	const { page } = await world.admin();

	await gotoHydrated(page, `/infra/orgs/${org.id}`);
	await action(page, 'Delete organization');
	const confirm = dialog(page).getByRole('button', { name: 'Delete organization' });
	await dialog(page).getByLabel(`Type ${org.slug} to confirm`).fill('wrong-slug');
	await confirm.click();
	await expect(dialog(page)).toBeVisible();
	await dialog(page).getByLabel(`Type ${org.slug} to confirm`).fill(org.slug);
	await confirm.click();
	await expect(page).toHaveURL(/\/infra\/orgs$/);

	await member.page.goto(`/o/${org.slug}`);
	await expect(member.page).toHaveURL(/\/orgs$/);

	await gotoHydrated(page, `/infra/orgs/${org.id}`);
	await action(page, 'Restore');
	await dialog(page).getByRole('button', { name: 'Restore' }).click();
	await expect(page.getByText('Organization restored.')).toBeVisible();
	expect((await member.page.goto(`/o/${org.slug}`))?.status()).toBe(200);
});

test('transferring ownership makes another member the owner', async ({ world, db }) => {
	const org = await world.createOrg();
	const heir = await world.createUser();
	await world.addMember(org, heir, { role: 'Administrator' });
	const { page } = await world.admin();

	await gotoHydrated(page, `/infra/orgs/${org.id}`);
	await action(page, 'Transfer ownership');
	await dialog(page).getByLabel('Find a member').fill(heir.email);
	await dialog(page).getByRole('button', { name: 'Search' }).click();
	await dialog(page)
		.getByLabel('New owner')
		.selectOption({ label: `${heir.name} (${heir.email})` });
	await dialog(page).getByRole('button', { name: 'Transfer' }).click();
	await expect(page.getByText('Ownership transferred.')).toBeVisible();

	const { rows } = await db.query(
		`SELECT user_id, role FROM auth.member WHERE organization_id = $1 AND role LIKE '%owner%'`,
		[org.id]
	);
	expect(rows.map((r) => r.user_id)).toEqual([heir.id]);
});

test('an admin removes a member, cancels an invitation, and turns off an invite link', async ({
	world,
	db
}) => {
	const org = await world.createOrg();
	const leaver = await world.createUser();
	await world.addMember(org, leaver);
	await db.query(
		`INSERT INTO auth.invitation (organization_id, email, role, status, inviter_id)
		 VALUES ($1, 'invitee@example.test', 'member', 'pending', $2)`,
		[org.id, org.owner.id]
	);
	await db.query(`INSERT INTO org_invite_link (id, org_id, created_by) VALUES ($1, $2, $3)`, [
		`infra${org.id.slice(0, 8)}`,
		org.id,
		org.owner.id
	]);
	const { page } = await world.admin();

	await gotoHydrated(page, `/infra/orgs/${org.id}?tab=members`);
	await page
		.getByRole('row')
		.filter({ hasText: leaver.email })
		.getByRole('button', { name: /Remove/ })
		.click();
	await dialog(page).getByRole('button', { name: 'Remove' }).click();
	await expect(page.getByText('Member removed.')).toBeVisible();
	expect(
		(
			await db.query(`SELECT 1 FROM auth.member WHERE organization_id = $1 AND user_id = $2`, [
				org.id,
				leaver.id
			])
		).rowCount
	).toBe(0);

	await gotoHydrated(page, `/infra/orgs/${org.id}?tab=invitations`);
	await page.getByRole('button', { name: 'Cancel invitation for invitee@example.test' }).click();
	await expect(page.getByText('Invitation cancelled.')).toBeVisible();
	await page.getByRole('button', { name: /^Turn off link made/ }).click();
	await expect(page.getByText('Invite link turned off.')).toBeVisible();

	const { rows } = await db.query(
		`SELECT expires_at <= now() AS closed FROM org_invite_link WHERE org_id = $1`,
		[org.id]
	);
	expect(rows).toEqual([{ closed: true }]);
});

test('someone without infra access is turned away from the panel and its API', async ({
	world
}) => {
	const org = await world.createOrg();
	const { page, request } = await world.as(org, 'owner');

	expect((await page.goto('/infra'))?.status()).toBe(403);
	expect((await request.get('/api/v1/organizations?page=1')).status()).toBe(403);
	expect((await request.post(`/api/v1/organizations/${org.id}/restorations`)).status()).toBe(403);
});
