import { test, expect } from './fixtures';
import { gotoHydrated, waitForHydration } from './helpers';

// Invite links and the open slug invite: making them on the members page, and
// joining through them at /invite/[token].

async function links(db: import('pg').Client, orgId: string) {
	const { rows } = await db.query<{ id: string; expires_at: Date | null }>(
		`SELECT id, expires_at FROM org_invite_link WHERE org_id = $1 ORDER BY created_at`,
		[orgId]
	);
	return rows;
}

async function isMember(db: import('pg').Client, orgId: string, userId: string) {
	const { rowCount } = await db.query(
		`SELECT 1 FROM auth.member WHERE organization_id = $1 AND user_id = $2`,
		[orgId, userId]
	);
	return rowCount === 1;
}

test('staff make a link that never expires, and someone joins the org through it', async ({
	world,
	db
}) => {
	const org = await world.createOrg();
	const { page } = await world.as(org, 'admin');

	await gotoHydrated(page, `/o/${org.slug}/s/members`);
	await page.getByRole('button', { name: 'Generate Link' }).click();
	await expect(page.getByRole('row').filter({ hasText: 'Never' })).toBeVisible();
	const [link] = await links(db, org.id);
	expect(link.expires_at).toBeNull();

	// A signed-out visitor is asked to sign in, then comes back to the invite.
	const joiner = await world.createUser();
	const visitor = await world.anonymous();
	await visitor.page.goto(`/invite/${link.id}`);
	await expect(visitor.page).toHaveURL(/\/auth\/signin\?redirectTo=/);
	await waitForHydration(visitor.page);
	await visitor.page.getByRole('textbox', { name: 'Email or Username' }).fill(joiner.email);
	await visitor.page.getByRole('textbox', { name: 'Password' }).fill(joiner.password);
	await visitor.page.getByRole('button', { name: 'Sign In' }).click();

	await expect(visitor.page).toHaveURL(new RegExp(`/invite/${link.id}$`));
	await expect(
		visitor.page.getByText("You've been invited to join this organization.")
	).toBeVisible();
	await visitor.page.getByRole('button', { name: `Join ${org.name}` }).click();

	await expect(visitor.page).toHaveURL(new RegExp(`/o/${org.slug}/?$`));
	expect(await isMember(db, org.id, joiner.id)).toBe(true);
	// A plain member: the default role only, no staff access.
	const { rows } = await db.query(
		`SELECT pr.name FROM user_role_membership urm JOIN permission_role pr ON pr.id = urm.role_id
		 WHERE urm.user_id = $1 AND pr.organization_id = $2`,
		[joiner.id, org.id]
	);
	expect(rows.map((r) => r.name)).not.toContain('Administrator');
});

test('a link can be made with an expiry date', async ({ world, db }) => {
	const org = await world.createOrg();
	const { page } = await world.as(org, 'admin');

	await gotoHydrated(page, `/o/${org.slug}/s/members`);
	const year = new Date().getFullYear() + 1;
	await page.getByRole('spinbutton', { name: /month/i }).click();
	await page.keyboard.type(`1231${year}`);
	await page.getByRole('button', { name: 'Generate Link' }).click();

	await expect(page.getByRole('row').filter({ hasText: `Dec 31, ${year}` })).toBeVisible();
	const [link] = await links(db, org.id);
	expect(link.expires_at?.getFullYear()).toBe(year);
});

test('a revoked link stops working', async ({ world, db }) => {
	const org = await world.createOrg();
	const { page } = await world.as(org, 'admin');

	await gotoHydrated(page, `/o/${org.slug}/s/members`);
	await page.getByRole('button', { name: 'Generate Link' }).click();
	await expect(page.getByRole('button', { name: 'Revoke link' })).toBeVisible();
	const [link] = await links(db, org.id);

	await page.getByRole('button', { name: 'Revoke link' }).click();
	await expect(page.getByRole('button', { name: 'Revoke link' })).toHaveCount(0);
	expect(await links(db, org.id)).toEqual([]);

	const joiner = await world.signIn(await world.createUser());
	const res = await joiner.page.goto(`/invite/${link.id}`);
	expect(res?.status()).toBe(404);
});

test('an expired link answers 404, and so does an unknown one', async ({ world, db }) => {
	const org = await world.createOrg();
	await db.query(
		`INSERT INTO org_invite_link (id, org_id, created_by, expires_at) VALUES ($1, $2, $3, now() - interval '1 day')`,
		[`expired${org.id.slice(0, 8)}`, org.id, org.owner.id]
	);
	const { page } = await world.signIn(await world.createUser());

	expect((await page.goto(`/invite/expired${org.id.slice(0, 8)}`))?.status()).toBe(404);
	expect((await page.goto('/invite/no-such-token-at-all'))?.status()).toBe(404);
});

test('a member following an invite is told they are already in, and nothing changes', async ({
	world,
	db
}) => {
	const org = await world.createOrg();
	await db.query(`INSERT INTO org_invite_link (id, org_id, created_by) VALUES ($1, $2, $3)`, [
		`again${org.id.slice(0, 8)}`,
		org.id,
		org.owner.id
	]);
	const member = await world.as(org, 'volunteer');

	await gotoHydrated(member.page, `/invite/again${org.id.slice(0, 8)}`);
	await expect(member.page.getByText(`You're already a member of`)).toBeVisible();
	await member.page.getByRole('link', { name: `Go to ${org.name}` }).click();
	await expect(member.page).toHaveURL(new RegExp(`/o/${org.slug}/?$`));
});

test('the slug invite lets anyone join at /invite/[slug] while it is on, and stops when turned off', async ({
	world,
	db
}) => {
	const org = await world.createOrg();
	const { page } = await world.as(org, 'admin');
	const slugSwitch = page.getByRole('switch', { name: 'Enable invite via organization slug' });

	await gotoHydrated(page, `/o/${org.slug}/s/members`);
	await slugSwitch.click();
	await expect(slugSwitch).toBeChecked();
	await expect(page.getByRole('button', { name: 'Copy slug invite URL' })).toBeVisible();

	const joiner = await world.createUser();
	const joining = await world.signIn(joiner);
	await gotoHydrated(joining.page, `/invite/${org.slug}`);
	await joining.page.getByRole('button', { name: `Join ${org.name}` }).click();
	await expect(joining.page).toHaveURL(new RegExp(`/o/${org.slug}/?$`));
	expect(await isMember(db, org.id, joiner.id)).toBe(true);

	await slugSwitch.click();
	await expect(slugSwitch).not.toBeChecked();
	const late = await world.signIn(await world.createUser());
	expect((await late.page.goto(`/invite/${org.slug}`))?.status()).toBe(404);
});

test('without member.invite the invite section is hidden and the endpoints refuse', async ({
	world
}) => {
	const org = await world.createOrg();
	const organizer = await world.as(org, 'organizer'); // member.read but not member.invite

	await gotoHydrated(organizer.page, `/o/${org.slug}/s/members`);
	await expect(organizer.page.getByRole('heading', { name: 'Members' })).toBeVisible();
	await expect(organizer.page.getByRole('heading', { name: 'Invite Links' })).toHaveCount(0);

	expect(
		(await organizer.request.get(`/api/v1/organizations/${org.id}/invite-links`)).status()
	).toBe(403);
	expect(
		(
			await organizer.request.post(`/api/v1/organizations/${org.id}/invite-links`, { data: {} })
		).status()
	).toBe(403);
	expect(
		(
			await organizer.request.put(`/api/v1/organizations/${org.id}/slug-invite`, {
				data: { enabled: true }
			})
		).status()
	).toBe(403);
});

test('a link from another org cannot be revoked, and looks unknown', async ({ world, db }) => {
	const org = await world.createOrg();
	await db.query(`INSERT INTO org_invite_link (id, org_id, created_by) VALUES ($1, $2, $3)`, [
		`theirs${org.id.slice(0, 8)}`,
		org.id,
		org.owner.id
	]);
	const otherOrg = await world.createOrg();
	const otherAdmin = await world.as(otherOrg, 'admin');

	const res = await otherAdmin.request.delete(`/api/v1/invite-links/theirs${org.id.slice(0, 8)}`);
	expect(res.status()).toBe(404);
	expect(await links(db, org.id)).toHaveLength(1);
});
