import { test, expect } from './fixtures';
import { gotoHydrated } from './helpers';

// Permission roles: the roles list, renaming, permission sets, the
// administrator and default role guards, and deleting.
// Creating a role has no UI since 8bccb6a, so it is checked through the API.

function roleRow(page: import('@playwright/test').Page, name: string) {
	return page.getByRole('row').filter({ has: page.getByRole('link', { name, exact: true }) });
}

test('the roles page lists every role with its permission count and the default', async ({
	world,
	db
}) => {
	const org = await world.createOrg();
	const { page } = await world.as(org, 'owner');
	const { rows } = await db.query<{ n: number }>(
		`SELECT count(*)::int AS n FROM registered_permission WHERE scope = 'organization'`
	);

	await gotoHydrated(page, `/o/${org.slug}/s/settings/roles`);
	await expect(roleRow(page, 'Administrator')).toContainText(String(rows[0].n));
	await expect(roleRow(page, 'Organizer')).toContainText('15');
	await expect(roleRow(page, 'Everyone')).toContainText('Yes');
	await expect(roleRow(page, 'Everyone').getByRole('button', { name: 'Delete role' })).toHaveCount(
		0
	);
});

test('without role.read the roles pages are closed', async ({ world }) => {
	const org = await world.createOrg();
	const { page } = await world.staffWith(org, ['member.read']);

	expect((await page.goto(`/o/${org.slug}/s/settings/roles`))?.status()).toBe(403);
	expect(
		(await page.goto(`/o/${org.slug}/s/settings/roles/${org.roles.Organizer}`))?.status()
	).toBe(403);
});

test('a role created through the API appears in the list and grants nothing', async ({ world }) => {
	const org = await world.createOrg();
	const owner = await world.as(org, 'owner');

	const res = await owner.request.post(`/api/v1/organizations/${org.id}/roles`, {
		data: { name: 'Door Captains' }
	});
	expect(res.status()).toBe(201);
	expect(await res.json()).toMatchObject({ name: 'Door Captains', permissions: [] });

	await gotoHydrated(owner.page, `/o/${org.slug}/s/settings/roles`);
	await expect(roleRow(owner.page, 'Door Captains')).toContainText('0');
});

test('renaming a role', async ({ world }) => {
	const org = await world.createOrg();
	const { page } = await world.as(org, 'owner');

	await gotoHydrated(page, `/o/${org.slug}/s/settings/roles/${org.roles.Analyst}`);
	await page.getByRole('textbox', { name: 'Name' }).fill('Researchers');
	await page.getByRole('button', { name: 'Save' }).click();

	await expect(page.getByRole('heading', { name: 'Researchers', level: 1 })).toBeVisible();
	await gotoHydrated(page, `/o/${org.slug}/s/settings/roles`);
	await expect(roleRow(page, 'Researchers')).toBeVisible();
});

test('switching a permission on a role changes what its members can do', async ({ world }) => {
	const org = await world.createOrg();
	const roleId = await world.createRole(org, 'Captains', ['canvass.use']);
	const captain = await world.createUser();
	const memberId = await world.addMember(org, captain);
	await world.db.query(
		`INSERT INTO user_role_membership (user_id, member_id, role_id) VALUES ($1, $2, $3)`,
		[captain.id, memberId, roleId]
	);
	const owner = await world.as(org, 'owner');
	const member = await world.signIn(captain);
	const staffHome = `/o/${org.slug}/s`;

	expect((await member.page.goto(staffHome))?.status()).toBe(403);

	await gotoHydrated(owner.page, `/o/${org.slug}/s/settings/roles/${roleId}`);
	const access = owner.page.getByRole('switch', {
		name: 'Captains can access the staff dashboard'
	});
	await access.click();
	await expect(access).toBeChecked();
	await expect(owner.page.getByText('Saving…')).toHaveCount(0);

	expect((await member.page.goto(staffHome))?.status()).toBe(200);

	await access.click();
	await expect(access).not.toBeChecked();
	await expect(owner.page.getByText('Saving…')).toHaveCount(0);
	expect((await member.page.goto(staffHome))?.status()).toBe(403);
});

test('the administrator role always keeps staff access', async ({ world }) => {
	const org = await world.createOrg();
	const owner = await world.as(org, 'owner');

	await gotoHydrated(owner.page, `/o/${org.slug}/s/settings/roles/${org.roles.Administrator}`);
	await expect(
		owner.page.getByRole('switch', { name: 'Administrator can access the staff dashboard' })
	).toBeDisabled();

	const res = await owner.request.put(`/api/v1/roles/${org.roles.Administrator}/permissions`, {
		data: { permissions: ['canvass.use'] }
	});
	expect(res.status()).toBe(200);
	expect((await res.json()).permissions).toEqual(['canvass.use', 'system.access']);
});

test('the default role cannot be renamed or deleted', async ({ world }) => {
	const org = await world.createOrg();
	const owner = await world.as(org, 'owner');

	await gotoHydrated(owner.page, `/o/${org.slug}/s/settings/roles/${org.roles.Everyone}`);
	await owner.page.getByRole('textbox', { name: 'Name' }).fill('Anyone');
	await owner.page.getByRole('button', { name: 'Save' }).click();
	await expect(owner.page.getByRole('alert')).toContainText('cannot be renamed');

	expect((await owner.request.delete(`/api/v1/roles/${org.roles.Everyone}`)).status()).toBe(409);
});

test('deleting a role removes it, and its members keep their other roles', async ({
	world,
	db
}) => {
	const org = await world.createOrg();
	const roleId = await world.createRole(org, 'Temporary', ['canvass.use']);
	const { page } = await world.as(org, 'owner');

	await gotoHydrated(page, `/o/${org.slug}/s/settings/roles`);
	await roleRow(page, 'Temporary').getByRole('button', { name: 'Delete role' }).click();
	await expect(page.getByText('Role deleted.')).toBeVisible();
	await expect(roleRow(page, 'Temporary')).toHaveCount(0);

	const { rowCount } = await db.query(`SELECT 1 FROM permission_role WHERE id = $1`, [roleId]);
	expect(rowCount).toBe(0);
});

test("another org's role answers 404 on the page and the API", async ({ world }) => {
	const org = await world.createOrg();
	const otherOrg = await world.createOrg();
	const otherOwner = await world.as(otherOrg, 'owner');

	expect(
		(
			await otherOwner.page.goto(`/o/${otherOrg.slug}/s/settings/roles/${org.roles.Organizer}`)
		)?.status()
	).toBe(404);
	expect((await otherOwner.request.get(`/api/v1/roles/${org.roles.Organizer}`)).status()).toBe(404);
	expect(
		(
			await otherOwner.request.patch(`/api/v1/roles/${org.roles.Organizer}`, {
				data: { name: 'Mine' }
			})
		).status()
	).toBe(404);
	expect((await otherOwner.request.delete(`/api/v1/roles/${org.roles.Organizer}`)).status()).toBe(
		404
	);
});
