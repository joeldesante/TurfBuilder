import { test, expect } from './fixtures';
import { gotoHydrated } from './helpers';
import { suffix } from './fixtures/world';

// The org picker, creating an organization, and the join-an-org page.

async function setCreation(db: import('pg').Client, allowed: boolean) {
	await db.query(
		`UPDATE system_setting SET value = $1 WHERE key = 'organizations.allow_creation'`,
		[String(allowed)]
	);
}

test.describe('the org picker', () => {
	test('lists the user’s organizations and opens one', async ({ world }) => {
		const org = await world.createOrg();
		const { page } = await world.as(org, 'volunteer');

		await gotoHydrated(page, '/orgs');
		await expect(page.getByRole('heading', { name: 'Select Organization' })).toBeVisible();
		await page.getByRole('button', { name: org.name }).click();

		await expect(page).toHaveURL(new RegExp(`/o/${org.slug}/?$`));
	});

	test('welcomes someone in no organization with ways to join or create one', async ({ world }) => {
		const user = await world.createUser();
		const { page } = await world.signIn(user);

		await gotoHydrated(page, '/orgs');
		await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
		await expect(page.getByText('You are not yet in an organization.')).toBeVisible();

		await page.getByRole('link', { name: /join/i }).first().click();
		await expect(page).toHaveURL(/\/orgs\/join$/);
		await expect(page.getByText('Ask your organizer for an invite link.')).toBeVisible();
	});
});

test.describe('creating an organization', () => {
	// The setting is instance-wide, so these run one at a time and restore it.
	test.describe.configure({ mode: 'serial' });
	test.afterEach(async ({ db }) => setCreation(db, true));

	test('creates it with the creator as owner and the four starting roles', async ({
		world,
		db
	}) => {
		const user = await world.createUser();
		const { page } = await world.signIn(user);
		const s = suffix();

		await gotoHydrated(page, '/orgs/create');
		await page.getByRole('textbox', { name: 'Name' }).fill(`Riverside ${s}`);
		await page.getByRole('textbox', { name: 'Slug' }).fill(`riverside-${s}`);
		await page.getByRole('button', { name: 'Create Organization' }).click();
		await expect(page).toHaveURL(new RegExp(`/o/riverside-${s}`));

		const { rows } = await db.query<{ role: string; roles: string[] }>(
			`SELECT m.role, array_agg(pr.name ORDER BY pr.weight) AS roles
			 FROM auth.organization o
			 JOIN auth.member m ON m.organization_id = o.id AND m.user_id = $2
			 JOIN permission_role pr ON pr.organization_id = o.id
			 WHERE o.slug = $1 GROUP BY m.role`,
			[`riverside-${s}`, user.id]
		);
		expect(rows[0].role).toBe('owner');
		expect(rows[0].roles).toEqual(['Administrator', 'Organizer', 'Analyst', 'Everyone']);
	});

	test('flags a taken slug while typing and refuses to create it', async ({ world }) => {
		const taken = await world.createOrg();
		const { page } = await world.signIn(await world.createUser());

		await gotoHydrated(page, '/orgs/create');
		await page.getByRole('textbox', { name: 'Name' }).fill('Duplicate');
		await page.getByRole('textbox', { name: 'Slug' }).fill(taken.slug);
		await expect(page.getByText('That slug is already taken.')).toBeVisible();

		await page.getByRole('button', { name: 'Create Organization' }).click();
		await expect(page).toHaveURL(/\/orgs\/create$/);
	});

	test('is closed when an admin turns creation off: no button, the page redirects, the API refuses', async ({
		world,
		db
	}) => {
		const org = await world.createOrg();
		const { page, request } = await world.as(org, 'volunteer');
		await setCreation(db, false);

		await gotoHydrated(page, '/orgs');
		await expect(page.getByRole('link', { name: /Start a New Movement/ })).toHaveCount(0);

		await page.goto('/orgs/create');
		await expect(page).toHaveURL(/\/orgs$/);

		const res = await request.post('/api/v1/organizations', {
			data: { name: 'Nope', slug: `nope-${suffix()}` }
		});
		expect(res.status()).toBe(403);
	});

	test('the create button shows while creation is allowed', async ({ world }) => {
		const org = await world.createOrg();
		const { page } = await world.as(org, 'volunteer');

		await gotoHydrated(page, '/orgs');
		await expect(page.getByRole('link', { name: /Start a New Movement/ })).toBeVisible();
	});
});

test.describe('the organization API', () => {
	test('a member reads the org; the owner renames it; a non-member gets 404', async ({ world }) => {
		const org = await world.createOrg();
		const owner = await world.as(org, 'owner');
		const outsider = await world.as(org, 'outsider');

		const read = await owner.request.get(`/api/v1/organizations/${org.id}`);
		expect(read.status()).toBe(200);
		expect(await read.json()).toMatchObject({ id: org.id, slug: org.slug });

		const renamed = await owner.request.patch(`/api/v1/organizations/${org.id}`, {
			data: { name: 'Renamed Org' }
		});
		expect(renamed.status()).toBe(200);
		expect(await renamed.json()).toMatchObject({ name: 'Renamed Org' });

		expect((await outsider.request.get(`/api/v1/organizations/${org.id}`)).status()).toBe(404);
	});

	test('a plain member cannot rename the org', async ({ world }) => {
		const org = await world.createOrg();
		const volunteer = await world.as(org, 'volunteer');

		const res = await volunteer.request.patch(`/api/v1/organizations/${org.id}`, {
			data: { name: 'Mine now' }
		});
		expect([403, 404]).toContain(res.status());
	});
});
