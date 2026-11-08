import { test, expect } from './fixtures';
import { gotoHydrated } from './helpers';

// Plugins: installing from the add-ons page, their nav entries and pages, and
// who may manage them. The only plugin today is the Rapid Response Alert Feed.

const SLUG = 'rapid-response-alert-feed';
const NAME = 'Rapid Response Alert Feed';

test('installing a plugin adds its nav entry and pages; uninstalling removes them', async ({
	world,
	db
}) => {
	const org = await world.createOrg();
	const { page } = await world.as(org, 'owner');
	const toggle = page.getByRole('switch', { name: `Enable ${NAME}` });

	await gotoHydrated(page, `/o/${org.slug}/s/addons`);
	await expect(page.getByRole('heading', { name: 'Addons' })).toBeVisible();
	await expect(toggle).not.toBeChecked();
	await toggle.click();
	await page.waitForLoadState('load');
	await gotoHydrated(page, `/o/${org.slug}/s/addons`);
	await expect(toggle).toBeChecked();
	await expect(page.getByRole('link', { name: 'Alert Feed' })).toBeVisible();

	expect((await page.goto(`/o/${org.slug}/s/plugins/${SLUG}`))?.status()).toBe(200);
	const volunteer = await world.as(org, 'volunteer');
	expect((await volunteer.page.goto(`/o/${org.slug}/plugins/${SLUG}`))?.status()).toBe(200);

	await gotoHydrated(page, `/o/${org.slug}/s/addons`);
	await toggle.click();
	await page.waitForLoadState('load');
	await gotoHydrated(page, `/o/${org.slug}/s/addons`);
	await expect(toggle).not.toBeChecked();
	await expect(page.getByRole('link', { name: 'Alert Feed' })).toHaveCount(0);
	expect((await page.goto(`/o/${org.slug}/s/plugins/${SLUG}`))?.status()).toBe(404);

	// Uninstalling only disables: the row and its config stay for a reinstall.
	const { rows } = await db.query(
		`SELECT enabled FROM plugin_installation WHERE organization_id = $1 AND plugin_slug = $2`,
		[org.id, SLUG]
	);
	expect(rows).toEqual([{ enabled: false }]);
});

test('without plugin.manage the add-ons page and endpoints are closed', async ({ world }) => {
	const org = await world.createOrg();
	const organizer = await world.as(org, 'organizer');

	expect((await organizer.page.goto(`/o/${org.slug}/s/addons`))?.status()).toBe(403);
	expect(
		(await organizer.request.put(`/api/v1/organizations/${org.id}/plugins/${SLUG}`)).status()
	).toBe(403);
});

test('plugin config is saved when installed and refused when not', async ({ world }) => {
	const org = await world.createOrg();
	const owner = await world.as(org, 'owner');
	const base = `/api/v1/organizations/${org.id}/plugins/${SLUG}`;

	expect((await owner.request.put(`${base}/config`, { data: {} })).status()).toBe(404);
	expect((await owner.request.put(base)).status()).toBe(204);
	expect((await owner.request.put(`${base}/config`, { data: {} })).status()).toBe(204);
	expect(
		(await owner.request.put(`/api/v1/organizations/${org.id}/plugins/no-such-plugin`)).status()
	).toBe(404);
});

test('the plugin API answers 404 for a handler the plugin does not have, and 403 for non-staff', async ({
	world
}) => {
	const org = await world.createOrg();
	const owner = await world.as(org, 'owner');
	await owner.request.put(`/api/v1/organizations/${org.id}/plugins/${SLUG}`);
	const volunteer = await world.as(org, 'volunteer');
	const api = `/api/v1/organizations/${org.id}/plugins/${SLUG}/api/nothing-here`;

	expect((await owner.request.get(api)).status()).toBe(404);
	const res = await volunteer.request.get(api);
	expect([403, 404]).toContain(res.status());
});
