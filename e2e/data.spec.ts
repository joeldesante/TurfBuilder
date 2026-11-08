import { test, expect } from './fixtures';
import { gotoHydrated } from './helpers';
import { csv, suffix } from './fixtures/world';
import { LOCATIONS, PEOPLE } from './fixtures/data';

// The universe data pages: people, the locations browser (adding, editing,
// moving, deleting, photos), imports, suggestion review, entity pages, and
// integrations.

// Photo uploads go to presigned links at http://s3:9090; the browser runs on the host.
test.use({ launchOptions: { args: ['--host-resolver-rules=MAP s3 127.0.0.1'] } });

async function current(db: import('pg').Client, orgId: string, name: string) {
	const { rows } = await db.query(
		`SELECT entity_id, name, address_line_1, ST_Y(coordinates) AS lat, ST_X(coordinates) AS lng, photo_keys
		 FROM universe.org_location WHERE org_id = $1 AND name = $2 AND valid_to IS NULL`,
		[orgId, name]
	);
	return rows[0];
}

test.describe('people', () => {
	// The manage page that had a people import now redirects (retired), so
	// people come in through the import endpoint only.
	test('imported people are listed, bad rows are reported, and a profile opens', async ({
		world
	}) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const rows = [
			...PEOPLE,
			{ first_name: 'Bad', last_name: 'Date', dob: '12/01/1990', email: '', phone: '' }
		];

		const res = await staff.request.post(`/api/v1/organizations/${org.id}/people-imports`, {
			multipart: {
				file: { name: 'people.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(rows)) }
			}
		});
		expect(await res.json()).toEqual({
			imported: 3,
			skipped: 1,
			errors: [{ row: 4, reason: 'dob must be in YYYY-MM-DD format' }]
		});

		await gotoHydrated(staff.page, `/o/${org.slug}/s/universe/data/people`);
		await expect(staff.page.getByText('Lovelace')).toBeVisible();
		await staff.page.getByText('Lovelace').click();
		await expect(staff.page).toHaveURL(/\/universe\/people\/[0-9a-f-]+$/);
		await expect(staff.page.getByText('ada@example.test').first()).toBeVisible();
	});

	test('the retired manage page sends staff on to the data pages', async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');

		await staff.page.goto(`/o/${org.slug}/s/universe/manage`);
		await expect(staff.page).toHaveURL(/\/universe\/data\//);
	});

	test('a file that is not a CSV is refused', async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');

		const res = await staff.request.post(`/api/v1/organizations/${org.id}/people-imports`, {
			multipart: {
				file: {
					name: 'people.xlsx',
					mimeType: 'application/octet-stream',
					buffer: Buffer.from('x')
				}
			}
		});
		expect(res.status()).toBe(400);
	});
});

test.describe('the locations browser', () => {
	test('lists locations, switches to the map, and imports a CSV from the import page', async ({
		world,
		db
	}) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');

		await gotoHydrated(staff.page, `/o/${org.slug}/s/universe/data/locations/import/csv`);
		await staff.page.getByLabel('Select CSV file').setInputFiles({
			name: 'locations.csv',
			mimeType: 'text/csv',
			buffer: Buffer.from(csv(LOCATIONS))
		});
		await expect
			.poll(async () => (await current(db, org.id, 'City Hall'))?.address_line_1)
			.toBe('1400 John F Kennedy Blvd');

		await gotoHydrated(staff.page, `/o/${org.slug}/s/universe/data/locations`);
		for (const l of LOCATIONS)
			await expect(staff.page.getByText(String(l.name)).first()).toBeVisible();
		await staff.page
			.getByRole('group', { name: 'View' })
			.getByRole('button', { name: 'Map' })
			.click();
		await expect(staff.page.locator('.maplibregl-canvas')).toBeVisible();
	});

	test('adding a location by dropping a pin', async ({ world, db }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const page = staff.page;
		const name = `Corner Store ${suffix()}`;

		await gotoHydrated(page, `/o/${org.slug}/s/universe/data/locations`);
		await page.getByRole('button', { name: 'Add location' }).click();
		const canvas = page.locator('.maplibregl-canvas');
		await expect(canvas).toBeVisible();
		const box = (await canvas.boundingBox())!;
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
		await page.getByRole('textbox', { name: /^(Business )?name$/i }).fill(name);
		await page.getByRole('textbox', { name: 'Street address' }).fill('5 Elm St');
		await page.getByRole('button', { name: 'Add location' }).last().click();

		await expect
			.poll(async () => (await current(db, org.id, name))?.address_line_1)
			.toBe('5 Elm St');
	});

	test('editing a location from its map popup', async ({ world }) => {
		// The map reloads its locations each time it settles and rebuilds every
		// marker, which closes the popup that holds Edit, so this cannot be done
		// in the browser yet (DATA-07, logged in step 4).
		test.fixme(true, 'DATA-07: the locations map closes marker popups as it reloads');
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		await world.importLocations(staff, org, [LOCATIONS[0]]);

		await gotoHydrated(staff.page, `/o/${org.slug}/s/universe/data/locations`);
		await staff.page
			.getByRole('group', { name: 'View' })
			.getByRole('button', { name: 'Map' })
			.click();
		await staff.page.getByRole('button', { name: /Liberty Bell/ }).click();
		await expect(staff.page.getByRole('button', { name: 'Edit' })).toBeVisible();
	});

	test('editing a location makes a new version and keeps the old one', async ({ world, db }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const [entityId] = await world.importLocations(staff, org, [LOCATIONS[0]]);

		const res = await staff.request.patch(`/o/${org.slug}/s/api/universe/locations/${entityId}`, {
			data: { address_line_1: '520 Chestnut St', latitude: 39.9489, longitude: -75.15 }
		});
		expect(res.ok()).toBe(true);

		const { rows } = await db.query(
			`SELECT address_line_1, valid_to IS NULL AS current FROM universe.org_location
			 WHERE entity_id = $1 ORDER BY valid_from`,
			[entityId]
		);
		expect(rows).toEqual([
			{ address_line_1: '526 Market St', current: false },
			{ address_line_1: '520 Chestnut St', current: true }
		]);
		expect((await current(db, org.id, 'Liberty Bell')).lat).toBeCloseTo(39.9489, 4);

		await gotoHydrated(staff.page, `/o/${org.slug}/s/universe/entity/${entityId}`);
		// The entity page shows the current version.
		await expect(staff.page.getByText('520 Chestnut St').first()).toBeVisible();
		await expect(staff.page.getByText('526 Market St')).toHaveCount(0);
	});

	test('a photo is uploaded to object storage, attached to a location, and served only to its org', async ({
		world,
		db
	}) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const [entityId] = await world.importLocations(staff, org, [LOCATIONS[0]]);
		const png = Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
			'base64'
		);

		const presigned = await staff.request.post(`/o/${org.slug}/uploads/presign`, {
			data: { contentType: 'image/png', contentLength: png.length }
		});
		expect(presigned.ok()).toBe(true);
		const { url, key } = (await presigned.json()) as { url: string; key: string };
		const put = await fetch(url.replace('//s3:9090', '//localhost:9090'), {
			method: 'PUT',
			headers: { 'content-type': 'image/png' },
			body: png
		});
		expect(put.ok).toBe(true);

		const res = await staff.request.patch(`/o/${org.slug}/s/api/universe/locations/${entityId}`, {
			data: { photo_keys: [key] }
		});
		expect(res.ok()).toBe(true);
		expect((await current(db, org.id, 'Liberty Bell')).photo_keys).toEqual([key]);

		const photo = await staff.request.get(`/o/${org.slug}/uploads/${key}`, { maxRedirects: 0 });
		expect(photo.status()).toBeLessThan(400);
		const outsider = await world.as(await world.createOrg(), 'admin');
		expect(
			(await outsider.request.get(`/o/${org.slug}/uploads/${key}`, { maxRedirects: 0 })).status()
		).toBeGreaterThanOrEqual(300);
	});

	test('deleting a location from the list', async ({ world, db }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		await world.importLocations(staff, org, [LOCATIONS[2]]);

		await gotoHydrated(staff.page, `/o/${org.slug}/s/universe/data/locations`);
		await staff.page.getByRole('button', { name: /^Delete Camden Aquarium/ }).click();
		await staff.page
			.getByRole('dialog')
			.getByRole('button', { name: 'Delete', exact: true })
			.click();

		await expect.poll(async () => current(db, org.id, 'Camden Aquarium')).toBeUndefined();
	});

	test('without location permissions the add and delete controls are gone and the endpoints refuse', async ({
		world
	}) => {
		const org = await world.createOrg();
		const admin = await world.as(org, 'admin');
		const [entityId] = await world.importLocations(admin, org, [LOCATIONS[0]]);
		const reader = await world.staffWith(org, ['location.read']);

		await gotoHydrated(reader.page, `/o/${org.slug}/s/universe/data/locations`);
		await expect(reader.page.getByText('Liberty Bell').first()).toBeVisible();
		await expect(reader.page.getByRole('button', { name: 'Add location' })).toHaveCount(0);
		await expect(reader.page.getByRole('button', { name: /^Delete / })).toHaveCount(0);

		const base = `/o/${org.slug}/s/api/universe/locations`;
		expect(
			(await reader.request.patch(`${base}/${entityId}`, { data: { name: 'x' } })).status()
		).toBe(403);
		expect((await reader.request.delete(`${base}/${entityId}`)).status()).toBe(403);
	});
});

test.describe('reviewing suggestions', () => {
	async function withSuggestions(world: import('./fixtures').World) {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		await world.importLocations(staff, org, LOCATIONS);
		const bucket = await world.createBucket(staff, org);
		const list = await world.createList(staff, bucket.id);
		const survey = await world.createSurvey(staff, bucket.id);
		const turf = await world.createTurf(staff, org, { listId: list.id, surveyId: survey.id });
		const volunteer = await world.as(org, 'volunteer');
		await world.db.query(
			`INSERT INTO universe.turf_user (turf_id, user_id, org_id) VALUES ($1, $2, $3)`,
			[turf.id, volunteer.user.id, org.id]
		);
		const base = `/o/${org.slug}/map/${turf.id}/locations`;
		const added = await volunteer.request.post(base, {
			data: {
				name: 'New Deli',
				address_line_1: '9 Pine St',
				city: 'Philadelphia',
				latitude: 39.95,
				longitude: -75.16
			}
		});
		expect(added.status()).toBe(201);
		const [door] = await world.turfDoors(turf.id);
		const proposed = await volunteer.request.post(`${base}/${door.id}/edits`, {
			data: { name: 'Corrected Name', note: 'Sign says otherwise' }
		});
		expect(proposed.status()).toBe(201);
		return { org, staff };
	}

	test('approving a new door and an edit applies both', async ({ world, db }) => {
		const { org, staff } = await withSuggestions(world);
		const page = staff.page;

		await gotoHydrated(page, `/o/${org.slug}/s/universe/data/locations/suggestions`);
		await expect(page.getByText('New Deli').first()).toBeVisible();
		await page.getByRole('button', { name: 'Approve' }).first().click();
		await page.getByRole('button', { name: 'Apply' }).first().click();

		await expect
			.poll(
				async () =>
					(
						await db.query(`SELECT status FROM universe.location_suggestion WHERE org_id = $1`, [
							org.id
						])
					).rows[0]?.status
			)
			.not.toBe('tentative');
		await expect
			.poll(
				async () =>
					(
						await db.query(
							`SELECT status FROM universe.location_edit_suggestion WHERE org_id = $1`,
							[org.id]
						)
					).rows[0]?.status
			)
			.not.toBe('pending');
		expect(await current(db, org.id, 'Corrected Name')).toBeTruthy();
	});

	test('rejecting a new door deletes it, and declining an edit leaves the door as it was', async ({
		world,
		db
	}) => {
		const { org, staff } = await withSuggestions(world);
		const page = staff.page;

		await gotoHydrated(page, `/o/${org.slug}/s/universe/data/locations/suggestions`);
		await page
			.getByRole('button', { name: /^Reject/ })
			.first()
			.click();
		await page.getByRole('dialog').getByRole('button', { name: 'Reject and delete' }).click();
		await expect.poll(async () => current(db, org.id, 'New Deli')).toBeUndefined();

		await page
			.getByRole('button', { name: /^Decline/ })
			.first()
			.click();
		await page.getByRole('dialog').getByRole('button', { name: 'Decline', exact: true }).click();
		await expect
			.poll(
				async () =>
					(
						await db.query(
							`SELECT status FROM universe.location_edit_suggestion WHERE org_id = $1`,
							[org.id]
						)
					).rows[0]?.status
			)
			.not.toBe('pending');
		expect(await current(db, org.id, 'Corrected Name')).toBeUndefined();
	});
});

test.describe('integrations and other data pages', () => {
	test('staff see the integrations, but only an infra admin may switch one', async ({
		world,
		db
	}) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');

		await gotoHydrated(staff.page, `/o/${org.slug}/s/universe/data/integrations`);
		await expect(staff.page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
		expect(
			(await staff.request.patch('/api/v1/integrations/van', { data: { enabled: true } })).status()
		).toBe(403);

		const admin = await world.admin();
		expect(
			(await admin.request.patch('/api/v1/integrations/van', { data: { enabled: true } })).status()
		).toBe(200);
		const { rows } = await db.query(
			`SELECT value FROM system_setting WHERE key = 'integration.van.enabled'`
		);
		expect(rows[0].value).toBe('true');
		await admin.request.patch('/api/v1/integrations/van', { data: { enabled: false } });

		// The card's link is an overlay under its toggle, so follow it directly.
		await staff.page.goto(
			(await staff.page.getByRole('link', { name: /^Open/ }).first().getAttribute('href'))!
		);
		await expect(staff.page).toHaveURL(/\/data\/integrations\/[a-z_]+$/);
		await expect(staff.page.getByText('No configuration available yet.')).toBeVisible();
	});

	test('the data sources page sends staff to the integrations', async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');

		await staff.page.goto(`/o/${org.slug}/s/universe/data/sources`);
		await expect(staff.page).toHaveURL(/\/universe\/data\/integrations$/);
	});

	test('the Google Sheets import page opens', async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');

		await gotoHydrated(staff.page, `/o/${org.slug}/s/universe/data/locations/import/google-sheets`);
		await expect(staff.page.getByLabel('Google Sheets URL')).toBeVisible();
	});

	test("another org's people and locations are out of reach", async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		await world.importPeople(staff, org, PEOPLE);
		const outsider = await world.as(await world.createOrg(), 'admin');

		expect((await outsider.request.get(`/api/v1/organizations/${org.id}/people`)).status()).toBe(
			404
		);
		expect((await outsider.request.get(`/api/v1/organizations/${org.id}/locations`)).status()).toBe(
			404
		);
	});
});
