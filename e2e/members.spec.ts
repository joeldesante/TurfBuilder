import { test, expect } from './fixtures';
import { gotoHydrated } from './helpers';
import type { TestOrg } from './fixtures';

// The members page: listing, roles, removing members, and per-member
// permission overrides on the member detail page.

function row(page: import('@playwright/test').Page, email: string) {
	return page.getByRole('row').filter({ hasText: email });
}

/** Members straight in the database, for paging: no sign-in, so no password needed. */
async function bulkMembers(db: import('pg').Client, org: TestOrg, count: number) {
	await db.query(
		`WITH u AS (
			INSERT INTO auth."user" (name, username, display_username, email, email_verified)
			SELECT 'Bulk ' || lpad(g::text, 3, '0'), 'bulk' || $2 || g, 'bulk' || $2 || g,
			       'bulk' || $2 || '-' || g || '@example.test', true
			FROM generate_series(1, $3) g
			RETURNING id
		)
		INSERT INTO auth.member (user_id, organization_id, role) SELECT id, $1, 'member' FROM u`,
		[org.id, org.id.slice(0, 8), count]
	);
}

test.describe('the members list', () => {
	test('lists members with their role, a page at a time', async ({ world, db }) => {
		const org = await world.createOrg();
		const volunteer = await world.createUser();
		await world.addMember(org, volunteer);
		await bulkMembers(db, org, 105);
		const { page } = await world.as(org, 'admin');

		await gotoHydrated(page, `/o/${org.slug}/s/members`);
		await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
		// 108 members: the owner, the volunteer, the admin, and 105 bulk ones.
		await expect(page.getByText(/of 108 members/).first()).toBeVisible();
		await expect(page.getByRole('row')).toHaveCount(101); // the header and a page of 100

		await gotoHydrated(page, `/o/${org.slug}/s/members?page=2`);
		await expect(page.getByRole('row')).toHaveCount(9);
	});

	test('without member.read the page is closed', async ({ world }) => {
		const org = await world.createOrg();
		const { page } = await world.staffWith(org, []);

		const res = await page.goto(`/o/${org.slug}/s/members`);
		expect(res?.status()).toBe(403);
	});

	test('a member’s name opens their detail page', async ({ world }) => {
		const org = await world.createOrg();
		const volunteer = await world.createUser();
		await world.addMember(org, volunteer);
		const { page } = await world.as(org, 'admin');

		await gotoHydrated(page, `/o/${org.slug}/s/members`);
		await row(page, volunteer.email).getByRole('link', { name: volunteer.name }).click();

		await expect(page).toHaveURL(new RegExp(`/members/${volunteer.id}$`));
		await expect(page.getByRole('heading', { name: volunteer.name })).toBeVisible();
	});
});

test.describe('roles', () => {
	test('assigning a role gives the member its permissions', async ({ world }) => {
		const org = await world.createOrg();
		const volunteer = await world.createUser();
		await world.addMember(org, volunteer);
		const { page } = await world.as(org, 'admin');

		await gotoHydrated(page, `/o/${org.slug}/s/members`);
		await row(page, volunteer.email).getByRole('combobox').selectOption({ label: 'Organizer' });
		await expect(page.getByText('Role updated.')).toBeVisible();

		const member = await world.signIn(volunteer);
		const res = await member.page.goto(`/o/${org.slug}/s`);
		expect(res?.status()).toBe(200);
	});

	test('demoting the last administrator is refused with a message, and the role stays', async ({
		world
	}) => {
		const org = await world.createOrg();
		const { page } = await world.as(org, 'owner'); // the creator is the only Administrator

		await gotoHydrated(page, `/o/${org.slug}/s/members`);
		const picker = row(page, org.owner.email).getByRole('combobox');
		await picker.selectOption({ label: '— No role —' });

		await expect(page.getByText('Cannot remove the last administrator')).toBeVisible();
		await expect(picker).toHaveValue(org.roles.Administrator);
	});

	test('without member.update the role pickers are not shown and the API refuses', async ({
		world
	}) => {
		const org = await world.createOrg();
		const volunteer = await world.createUser();
		const memberId = await world.addMember(org, volunteer);
		const reader = await world.staffWith(org, ['member.read']);

		await gotoHydrated(reader.page, `/o/${org.slug}/s/members`);
		await expect(row(reader.page, volunteer.email)).toBeVisible();
		await expect(reader.page.getByRole('combobox')).toHaveCount(0);

		const res = await reader.request.patch(`/api/v1/members/${memberId}`, {
			data: { role_id: org.roles.Organizer }
		});
		expect(res.status()).toBe(403);
	});
});

test.describe('removing members', () => {
	test('removing a member takes away their access', async ({ world, db }) => {
		const org = await world.createOrg();
		const volunteer = await world.createUser();
		await world.addMember(org, volunteer);
		const { page } = await world.as(org, 'admin');

		await gotoHydrated(page, `/o/${org.slug}/s/members`);
		await row(page, volunteer.email).getByRole('button', { name: 'Remove member' }).click();
		await expect(page.getByText('Member removed.')).toBeVisible();
		await expect(row(page, volunteer.email)).toHaveCount(0);

		const { rowCount } = await db.query(
			`SELECT 1 FROM auth.member WHERE organization_id = $1 AND user_id = $2`,
			[org.id, volunteer.id]
		);
		expect(rowCount).toBe(0);
		const gone = await world.signIn(volunteer);
		await gone.page.goto(`/o/${org.slug}`);
		await expect(gone.page).toHaveURL(/\/orgs$/);
	});

	test('staff cannot remove themselves', async ({ world }) => {
		const org = await world.createOrg();
		const admin = await world.as(org, 'admin');

		await gotoHydrated(admin.page, `/o/${org.slug}/s/members`);
		await row(admin.page, admin.user.email).getByRole('button', { name: 'Remove member' }).click();

		await expect(
			admin.page.getByText('You cannot remove yourself from the organization.')
		).toBeVisible();
		await expect(row(admin.page, admin.user.email)).toBeVisible();
	});

	test('the only owner cannot be removed', async ({ world }) => {
		const org = await world.createOrg();
		const admin = await world.as(org, 'admin');

		await gotoHydrated(admin.page, `/o/${org.slug}/s/members`);
		await row(admin.page, org.owner.email).getByRole('button', { name: 'Remove member' }).click();

		await expect(admin.page.getByText('This is the only owner.')).toBeVisible();
		await expect(row(admin.page, org.owner.email)).toBeVisible();
	});

	test('without member.delete there is no remove button and the API refuses', async ({ world }) => {
		const org = await world.createOrg();
		const volunteer = await world.createUser();
		const memberId = await world.addMember(org, volunteer);
		const reader = await world.staffWith(org, ['member.read']);

		await gotoHydrated(reader.page, `/o/${org.slug}/s/members`);
		await expect(reader.page.getByRole('button', { name: 'Remove member' })).toHaveCount(0);
		expect((await reader.request.delete(`/api/v1/members/${memberId}`)).status()).toBe(403);
	});
});

test.describe('permission overrides', () => {
	test('granting, denying, and clearing a permission changes what the member can do', async ({
		world
	}) => {
		const org = await world.createOrg();
		const volunteer = await world.createUser();
		await world.addMember(org, volunteer);
		const admin = await world.as(org, 'admin');
		const member = await world.signIn(volunteer);
		const staffHome = `/o/${org.slug}/s`;
		const badge = admin.page.getByRole('button', { name: /^Staff Dashboard Access:/ });

		await gotoHydrated(admin.page, `/o/${org.slug}/s/members/${volunteer.id}`);
		await expect(badge).toHaveText('Inherited');
		expect((await member.page.goto(staffHome))?.status()).toBe(403);

		await badge.click();
		await expect(badge).toHaveText('Granted');
		expect((await member.page.goto(staffHome))?.status()).toBe(200);

		await badge.click();
		await expect(badge).toHaveText('Denied');
		expect((await member.page.goto(staffHome))?.status()).toBe(403);

		await badge.click();
		await expect(badge).toHaveText('Inherited');
	});

	test('a denial beats a role that grants the permission', async ({ world }) => {
		const org = await world.createOrg();
		const organizer = await world.createUser();
		const memberId = await world.addMember(org, organizer, { role: 'Organizer' });
		const admin = await world.as(org, 'admin');
		const { rows } = await world.db.query<{ id: string }>(
			`SELECT id FROM registered_permission WHERE key = 'system.access'`
		);

		const res = await admin.request.put(`/api/v1/members/${memberId}/permissions/${rows[0].id}`, {
			data: { value: false }
		});
		expect(res.status()).toBe(204);

		const member = await world.signIn(organizer);
		expect((await member.page.goto(`/o/${org.slug}/s`))?.status()).toBe(403);
	});
});

test.describe('isolation', () => {
	test("another org's member ids answer 404, and nothing changes", async ({ world, db }) => {
		const org = await world.createOrg();
		const volunteer = await world.createUser();
		const memberId = await world.addMember(org, volunteer);
		const otherOrg = await world.createOrg();
		const otherAdmin = await world.as(otherOrg, 'admin');

		expect(
			(
				await otherAdmin.request.patch(`/api/v1/members/${memberId}`, { data: { role_id: null } })
			).status()
		).toBe(404);
		expect((await otherAdmin.request.delete(`/api/v1/members/${memberId}`)).status()).toBe(404);
		const { rowCount } = await db.query(`SELECT 1 FROM auth.member WHERE id = $1`, [memberId]);
		expect(rowCount).toBe(1);
	});
});
