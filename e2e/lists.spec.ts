import { test, expect, type Session } from './fixtures';
import { gotoHydrated } from './helpers';
import { suffix } from './fixtures/world';
import { LOCATIONS } from './fixtures/data';
import type { TestOrg } from './fixtures';

// Lists snapshot a bucket's records; turfs are cut from them on a map.
// (The list PDF has its own spec, list-documents.spec.ts.)

async function setup(world: import('./fixtures').World) {
	const org = await world.createOrg();
	const staff = await world.as(org, 'admin');
	await world.importLocations(staff, org, LOCATIONS);
	const bucket = await world.createBucket(staff, org);
	return { org, staff, bucket };
}

function listPath(org: TestOrg, bucketSlug: string, listId: string) {
	return `/o/${org.slug}/s/universe/buckets/${bucketSlug}/lists/${listId}`;
}

test.describe('lists', () => {
	test('creating a list snapshots the bucket’s locations and opens it', async ({ world, db }) => {
		const { org, staff, bucket } = await setup(world);
		const name = `Ward 5 ${suffix()}`;
		const base = `/o/${org.slug}/s/universe/buckets/${bucket.slug}/lists`;

		await gotoHydrated(staff.page, `${base}/new`);
		await staff.page.getByRole('textbox', { name: 'Name' }).fill(name);
		await staff.page.getByLabel('Expiration Date').fill('2099-12-31');
		await staff.page.getByRole('radio', { name: 'Locations' }).check();
		await staff.page.getByRole('button', { name: 'Create List' }).click();

		// Back on the bucket's lists, with the new one there to open.
		await expect(staff.page).toHaveURL(new RegExp(`${base}$`));
		await staff.page.getByText(name).click();
		await expect(staff.page).toHaveURL(new RegExp(`${base}/[0-9a-f-]+$`));
		for (const l of LOCATIONS)
			await expect(staff.page.getByText(String(l.city)).first()).toBeVisible();

		const listId = staff.page.url().split('/').pop()!;
		const { rows } = await db.query(
			`SELECT count(*)::int AS n FROM universe.list_entry WHERE list_id = $1`,
			[listId]
		);
		expect(rows[0].n).toBe(4);
	});

	test('a list narrowed by a filter holds only its matches', async ({ world }) => {
		const { staff, bucket } = await setup(world);

		const list = await world.createList(staff, bucket.id, {
			filters: { operator: 'AND', filters: [{ item: 'state', operation: 'equals', value: 'NJ' }] }
		});
		const res = await staff.request.get(`/api/v1/lists/${list.id}/entries`);
		expect(((await res.json()) as { totalCount: number }).totalCount).toBe(1);
	});

	test('a list keeps the location versions it was made with when locations change afterwards', async ({
		world,
		db
	}) => {
		const { org, staff, bucket } = await setup(world);
		const list = await world.createList(staff, bucket.id);
		const { rows: before } = await db.query(
			`SELECT c.metadata->>'name' AS name FROM universe.list_entry le
			 JOIN universe.org_contact c ON c.id = le.record_id
			 WHERE le.list_id = $1 ORDER BY name`,
			[list.id]
		);

		// Rename one location the way staff do, through the locations endpoint.
		const { rows: target } = await db.query(
			`SELECT entity_id FROM universe.org_contact
			 WHERE org_id = $1 AND metadata->>'name' = 'City Hall' AND valid_to IS NULL`,
			[org.id]
		);
		const res = await staff.request.patch(`/api/v1/locations/${target[0].entity_id}`, {
			data: { name: 'Renamed Hall' }
		});
		expect(res.ok()).toBe(true);

		const { rows: after } = await db.query(
			`SELECT c.metadata->>'name' AS name FROM universe.list_entry le
			 JOIN universe.org_contact c ON c.id = le.record_id
			 WHERE le.list_id = $1 ORDER BY name`,
			[list.id]
		);
		expect(after).toEqual(before);
	});

	test('the list map shows the list', async ({ world }) => {
		const { org, staff, bucket } = await setup(world);
		const list = await world.createList(staff, bucket.id);

		const res = await staff.page.goto(`${listPath(org, bucket.slug, list.id)}/map`);
		expect(res?.status()).toBe(200);
		await expect(staff.page.locator('.maplibregl-canvas')).toBeVisible();
	});

	test("another org's list answers 404 on its page and the API", async ({ world }) => {
		const { org, staff, bucket } = await setup(world);
		const list = await world.createList(staff, bucket.id);
		const outsider = await world.as(await world.createOrg(), 'admin');

		expect((await outsider.request.get(`/api/v1/lists/${list.id}/entries`)).status()).toBe(404);
		await outsider.page.goto(listPath(org, bucket.slug, list.id));
		await expect(outsider.page).toHaveURL(/\/orgs$/);
	});
});

test.describe('cutting turfs', () => {
	async function openCutter(
		staff: Session,
		org: TestOrg,
		bucketSlug: string,
		listId: string,
		survey: string
	) {
		await gotoHydrated(staff.page, listPath(org, bucketSlug, listId));
		await staff.page.getByRole('button', { name: 'Cut Turfs' }).click();
		await staff.page.locator('#survey-select').selectOption({ label: survey });
		await staff.page.getByRole('button', { name: 'Proceed to Map' }).click();
		await expect(staff.page).toHaveURL(/\/cut$/);
	}

	test('the survey step needs a survey first', async ({ world }) => {
		const { org, staff, bucket } = await setup(world);
		const list = await world.createList(staff, bucket.id);

		await gotoHydrated(staff.page, listPath(org, bucket.slug, list.id));
		await staff.page.getByRole('button', { name: 'Cut Turfs' }).click();
		await expect(
			staff.page.getByText('No surveys available. Create a survey first before cutting turfs.')
		).toBeVisible();
	});

	test('drawing a turf on the map and saving it creates the turf with a code', async ({
		world,
		db
	}) => {
		const { org, staff, bucket } = await setup(world);
		const list = await world.createList(staff, bucket.id);
		const surveyName = `Doors ${suffix()}`;
		await world.createSurvey(staff, bucket.id, undefined, surveyName);
		const page = staff.page;

		await openCutter(staff, org, bucket.slug, list.id, surveyName);
		const canvas = page.locator('.maplibregl-canvas');
		await expect(canvas).toBeVisible();
		await expect(page.getByRole('button', { name: /Liberty Bell/ })).toBeVisible();

		// Draw a rectangle around the whole visible map.
		await page.locator('.gm-control-button[title="Polygon"], [title="Polygon"]').first().click();
		const box = (await canvas.boundingBox())!;
		const corners = [
			[box.x + 5, box.y + 5],
			[box.x + box.width - 5, box.y + 5],
			[box.x + box.width - 5, box.y + box.height - 5],
			[box.x + 5, box.y + box.height - 5],
			[box.x + 5, box.y + 5]
		];
		for (const [x, y] of corners) await page.mouse.click(x, y);
		await page.getByRole('button', { name: /Save Turfs/ }).click();

		await expect(page).toHaveURL(new RegExp(`/lists/${list.id}$`));
		const { rows } = await db.query<{ code: string; doors: number }>(
			`SELECT t.code, count(tl.id)::int AS doors FROM universe.turf t
			 LEFT JOIN universe.turf_location tl ON tl.turf_id = t.id
			 WHERE t.list_id = $1 GROUP BY t.id`,
			[list.id]
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].doors).toBeGreaterThan(0);
		await gotoHydrated(page, `${listPath(org, bucket.slug, list.id)}?tab=turfs`);
		await expect(page.getByText(rows[0].code).first()).toBeVisible();
	});

	test('the turf preview and the turf detail page show the turf’s doors', async ({ world }) => {
		const { org, staff, bucket } = await setup(world);
		const list = await world.createList(staff, bucket.id);
		const survey = await world.createSurvey(staff, bucket.id);
		const turf = await world.createTurf(staff, org, { listId: list.id, surveyId: survey.id });
		const page = staff.page;

		await gotoHydrated(page, `${listPath(org, bucket.slug, list.id)}?tab=turfs`);
		await page.getByRole('button', { name: `Preview turf ${turf.code}` }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.keyboard.press('Escape');

		await page.getByRole('link', { name: `Open turf ${turf.code} details` }).click();
		await expect(page).toHaveURL(new RegExp(`/turfs/${turf.id}$`));
		await expect(page.getByText('Total Locations')).toBeVisible();
		await expect(page.getByText('Liberty Bell').first()).toBeVisible();
		await expect(page.getByText(turf.code).first()).toBeVisible();
	});

	test('overlapping turfs from one list each get the doors inside them', async ({ world, db }) => {
		// Cutting does not take doors already in another turf of the list: the
		// cut map shows existing turfs so staff can avoid overlaps.
		const { org, staff, bucket } = await setup(world);
		const list = await world.createList(staff, bucket.id);
		const survey = await world.createSurvey(staff, bucket.id);
		const first = await world.createTurf(staff, org, { listId: list.id, surveyId: survey.id });
		const second = await world.createTurf(staff, org, { listId: list.id, surveyId: survey.id });

		const { rows } = await db.query<{ turf_id: string; n: number }>(
			`SELECT turf_id, count(*)::int AS n FROM universe.turf_location WHERE turf_id = ANY($1) GROUP BY turf_id`,
			[[first.id, second.id]]
		);
		expect(Object.fromEntries(rows.map((r) => [r.turf_id, r.n]))).toEqual({
			[first.id]: 4,
			[second.id]: 4
		});
	});
});
