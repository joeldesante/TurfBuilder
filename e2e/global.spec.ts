import { test, expect } from './fixtures';
import { gotoHydrated } from './helpers';

// Cross-cutting behavior: the front door, legal pages, org routing, the beta
// banner, and staying quiet when analytics are off.

test.describe('signed out', () => {
	test('the front page sends a visitor to sign in', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL(/\/auth\/signin/);
	});

	test('the privacy policy and terms of service open for anyone', async ({ page }) => {
		for (const path of ['/privacy', '/terms']) {
			const res = await page.goto(path);
			expect(res?.status(), path).toBe(200);
			await expect(page.getByRole('heading').first()).toBeVisible();
		}
	});

	test('robots.txt is served', async ({ request }) => {
		const res = await request.get('/robots.txt');
		expect(res.status()).toBe(200);
		expect(await res.text()).toContain('User-agent');
	});

	test('an org page sends a visitor to sign in', async ({ world }) => {
		const org = await world.createOrg();
		const { page } = await world.anonymous();

		await page.goto(`/o/${org.slug}`);
		await expect(page).toHaveURL(/\/auth\/signin/);
	});
});

test.describe('signed in', () => {
	test('the front page sends a member to the org picker', async ({ world }) => {
		const org = await world.createOrg();
		const { page } = await world.as(org, 'volunteer');

		await page.goto('/');
		await expect(page).toHaveURL(/\/orgs$/);
	});

	test('an unknown org slug, and an org the user is not in, send them to the org picker', async ({
		world
	}) => {
		const org = await world.createOrg();
		const { page } = await world.as(org, 'outsider');

		await page.goto('/o/no-such-org-anywhere');
		await expect(page).toHaveURL(/\/orgs$/);

		await page.goto(`/o/${org.slug}`);
		await expect(page).toHaveURL(/\/orgs$/);
		await page.goto(`/o/${org.slug}/s`);
		await expect(page).toHaveURL(/\/orgs$/);
	});

	test('the org home shows its name and a way to start canvassing', async ({ world }) => {
		const org = await world.createOrg();
		const { page } = await world.as(org, 'volunteer');

		await gotoHydrated(page, `/o/${org.slug}`);
		await expect(page.getByRole('heading', { name: org.name })).toBeVisible();
		await page.getByRole('link', { name: 'Begin Canvassing' }).click();
		await expect(page).toHaveURL(new RegExp(`/o/${org.slug}/join$`));
	});

	test('a suspended org closes to its members; infra admins can still look but not act in it', async ({
		world,
		db
	}) => {
		const org = await world.createOrg();
		const member = await world.as(org, 'organizer');
		const admin = await world.admin();
		await world.addMember(org, { id: await adminId(db) }, { role: 'Administrator' });
		await db.query(`UPDATE auth.organization SET suspended_at = now() WHERE id = $1`, [org.id]);

		for (const path of [`/o/${org.slug}`, `/o/${org.slug}/s`]) {
			const res = await member.page.goto(path);
			expect(res?.status(), path).toBe(403);
			await expect(member.page.getByText('This organization has been suspended')).toBeVisible();
		}

		// The hook lets an infra admin through, but a suspended org grants no
		// permissions to anyone, so its staff pages stay closed.
		expect((await admin.page.goto(`/o/${org.slug}`))?.status()).toBe(200);
		expect((await admin.page.goto(`/o/${org.slug}/s`))?.status()).toBe(403);
	});

	test('a deleted org is treated as one that does not exist', async ({ world, db }) => {
		const org = await world.createOrg();
		const { page } = await world.as(org, 'organizer');
		await db.query(`UPDATE auth.organization SET deleted_at = now() WHERE id = $1`, [org.id]);

		await page.goto(`/o/${org.slug}/s`);
		await expect(page).toHaveURL(/\/orgs$/);
	});

	test('the beta banner shows on staff pages and stays closed once dismissed', async ({
		world
	}) => {
		const org = await world.createOrg();
		const { page } = await world.as(org, 'owner');

		await gotoHydrated(page, `/o/${org.slug}/s`);
		const banner = page.getByRole('status').filter({ hasText: 'active early stage development' });
		await expect(banner).toBeVisible();

		await page.getByRole('button', { name: 'Close banner' }).click();
		await expect(banner).not.toBeVisible();

		await gotoHydrated(page, `/o/${org.slug}/s`);
		await expect(banner).toHaveCount(0);
	});

	test('no analytics requests leave the browser while analytics are off', async ({ world }) => {
		const org = await world.createOrg();
		const { page } = await world.as(org, 'owner');
		const outbound: string[] = [];
		page.on('request', (r) => {
			if (/posthog|i\.posthog\.com/.test(r.url())) outbound.push(r.url());
		});

		await gotoHydrated(page, `/o/${org.slug}/s`);
		await gotoHydrated(page, `/o/${org.slug}/s/members`);

		expect(outbound).toEqual([]);
	});
});

async function adminId(db: import('pg').Client): Promise<string> {
	const { rows } = await db.query<{ id: string }>(
		`SELECT id FROM auth."user" WHERE email = 'test@example.com'`
	);
	return rows[0].id;
}
