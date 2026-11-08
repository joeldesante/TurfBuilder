import { test, expect } from './fixtures';
import { gotoHydrated } from './helpers';
import { ALL, suffix, type LocationRow } from './fixtures/world';

// Buckets: making them, their pages, the filter editor, and what each filter
// selects. Filter semantics are checked through the bucket endpoints so every
// filter is covered without drawing on a map in the browser.

const LOCATIONS: LocationRow[] = [
	{
		name: 'Liberty Bell',
		address_line_1: '526 Market St',
		city: 'Philadelphia',
		state_or_region: 'PA',
		postal_code: '19106',
		country_code: 'US',
		latitude: 39.9496,
		longitude: -75.1503
	},
	{
		name: 'City Hall',
		address_line_1: '1400 John F Kennedy Blvd',
		city: 'Philadelphia',
		state_or_region: 'PA',
		postal_code: '19107',
		country_code: 'US',
		latitude: 39.9526,
		longitude: -75.1652
	},
	{
		name: 'Camden Aquarium',
		address_line_1: '1 Riverside Dr',
		city: 'Camden',
		state_or_region: 'NJ',
		postal_code: '08103',
		country_code: 'US',
		latitude: 39.9447,
		longitude: -75.1306
	},
	{
		name: 'Pittsburgh Point',
		address_line_1: '601 Commonwealth Pl',
		city: 'Pittsburgh',
		state_or_region: 'PA',
		postal_code: '15222',
		country_code: 'US',
		latitude: 40.4417,
		longitude: -80.0084
	}
];

const PEOPLE = [
	{
		first_name: 'Ada',
		last_name: 'Lovelace',
		dob: '1990-12-10',
		email: 'ada@example.test',
		phone: ''
	},
	{ first_name: 'Grace', last_name: 'Hopper', dob: '1960-12-09', email: '', phone: '555-0100' },
	{ first_name: 'Alan', last_name: 'Turing', dob: '2010-06-23', email: '', phone: '' }
];

function filter(item: string, operation: string, value: unknown) {
	return { operator: 'AND' as const, filters: [{ item, operation, value }] };
}

test.describe('making buckets', () => {
	test('creating a bucket with the form opens it and adds it to the sidebar', async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const name = `Voters ${suffix()}`;

		await gotoHydrated(staff.page, `/o/${org.slug}/s/universe/buckets/new`);
		await staff.page.getByRole('textbox', { name: 'Name' }).fill(name);
		await staff.page.getByRole('checkbox', { name: 'Locations' }).check();
		await staff.page.getByRole('button', { name: 'Create Bucket' }).click();

		const slug = name.toLowerCase().replace(/ /g, '-');
		// A bucket opens on its first page of records.
		await expect(staff.page).toHaveURL(new RegExp(`/universe/buckets/${slug}(/locations)?$`));
		await expect(staff.page.getByText(name, { exact: true }).first()).toBeVisible();
	});

	test('a second bucket with the same name is refused with a message', async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const bucket = await world.createBucket(staff, org);

		await gotoHydrated(staff.page, `/o/${org.slug}/s/universe/buckets/new`);
		await staff.page.getByRole('textbox', { name: 'Name' }).fill(bucket.name);
		await staff.page.getByRole('checkbox', { name: 'Locations' }).check();
		await staff.page.getByRole('button', { name: 'Create Bucket' }).click();

		await expect(staff.page.getByRole('alert')).not.toBeEmpty();
		await expect(staff.page).toHaveURL(/\/buckets\/new$/);
	});

	test('an unknown bucket slug answers 404', async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');

		expect(
			(await staff.page.goto(`/o/${org.slug}/s/universe/buckets/no-such-bucket`))?.status()
		).toBe(404);
	});
});

test.describe("a bucket's pages", () => {
	test('lists its locations and opens one, and lists its people and opens one', async ({
		world
	}) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		await world.importLocations(staff, org, LOCATIONS);
		await world.importPeople(staff, org, PEOPLE);
		const bucket = await world.createBucket(staff, org, { people: ALL, locations: ALL });
		const base = `/o/${org.slug}/s/universe/buckets/${bucket.slug}`;

		await gotoHydrated(staff.page, base);
		await expect(staff.page).toHaveURL(new RegExp(`${base}(/locations)?$`));

		await gotoHydrated(staff.page, `${base}/locations`);
		await expect(staff.page.getByText('Liberty Bell')).toBeVisible();
		await staff.page.getByText('Liberty Bell').click();
		await expect(staff.page).toHaveURL(new RegExp(`${base}/locations/[0-9a-f-]+$`));
		await expect(staff.page.getByText('526 Market St').first()).toBeVisible();

		await gotoHydrated(staff.page, `${base}/people`);
		await expect(staff.page.getByText('Lovelace')).toBeVisible();
		await staff.page.getByText('Lovelace').click();
		await expect(staff.page).toHaveURL(new RegExp(`${base}/people/[0-9a-f-]+$`));
		await expect(staff.page.getByText('Ada').first()).toBeVisible();
	});

	test('the people page says when the bucket has no people', async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const bucket = await world.createBucket(staff, org, { people: null, locations: ALL });

		const res = await staff.page.goto(`/o/${org.slug}/s/universe/buckets/${bucket.slug}/people`);
		expect(res?.status()).toBe(200);
		await expect(staff.page.getByText('Lovelace')).toHaveCount(0);
	});

	test('a bucket whose old filter cannot be converted shows why, and its filters page lets it be rebuilt', async ({
		world,
		db
	}) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const bucket = await world.createBucket(staff, org);
		await db.query(
			`UPDATE universe.bucket SET filters = NULL, filter = '{"nonsense": true}'::jsonb WHERE id = $1`,
			[bucket.id]
		);
		const base = `/o/${org.slug}/s/universe/buckets/${bucket.slug}`;

		expect((await staff.page.goto(`${base}/locations`))?.status()).toBe(422);
		expect((await staff.page.goto(`${base}/filters`))?.status()).toBe(200);
	});
});

test.describe('the filter editor', () => {
	test('adding a city filter and saving narrows the bucket', async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		await world.importLocations(staff, org, LOCATIONS);
		const bucket = await world.createBucket(staff, org);
		expect(await world.bucketCount(staff, bucket.id, 'locations')).toBe(4);

		await gotoHydrated(staff.page, `/o/${org.slug}/s/universe/buckets/${bucket.slug}/filters`);
		await staff.page.getByRole('button', { name: 'Add Filter' }).first().click();
		await staff.page.getByRole('dialog').getByRole('button', { name: /City/ }).first().click();
		await staff.page.getByRole('textbox', { name: 'Value' }).fill('Philadelphia');
		await staff.page
			.getByRole('dialog')
			.getByRole('button', { name: 'Add filter', exact: true })
			.click();
		await staff.page.getByRole('button', { name: 'Save Filters' }).click();

		await expect.poll(() => world.bucketCount(staff, bucket.id, 'locations')).toBe(2);
	});

	test('unsaved changes can be discarded', async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const bucket = await world.createBucket(staff, org);

		await gotoHydrated(staff.page, `/o/${org.slug}/s/universe/buckets/${bucket.slug}/filters`);
		await staff.page.getByRole('button', { name: 'Add Filter' }).first().click();
		await staff.page.getByRole('dialog').getByRole('button', { name: /City/ }).first().click();
		await staff.page.getByRole('textbox', { name: 'Value' }).fill('Nowhere');
		await staff.page
			.getByRole('dialog')
			.getByRole('button', { name: 'Add filter', exact: true })
			.click();
		await expect(staff.page.getByText('Unsaved changes')).toBeVisible();

		await staff.page.getByRole('button', { name: 'Discard Changes' }).click();
		await expect(staff.page.getByText('Unsaved changes')).toHaveCount(0);
		await expect(staff.page.getByRole('button', { name: 'Remove filter' })).toHaveCount(0);
	});
});

test.describe('what each filter selects', () => {
	test('location filters', async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		await world.importLocations(staff, org, LOCATIONS);
		const count = async (locations: ReturnType<typeof filter>) =>
			world.bucketCount(
				staff,
				(await world.createBucket(staff, org, { locations })).id,
				'locations'
			);

		const square = {
			type: 'Polygon',
			coordinates: [
				[
					[-75.2, 39.9],
					[-75.1, 39.9],
					[-75.1, 40.0],
					[-75.2, 40.0],
					[-75.2, 39.9]
				]
			]
		};
		const cases: [string, ReturnType<typeof filter>, number][] = [
			['city equals', filter('city', 'equals', 'Philadelphia'), 2],
			['city not equals', filter('city', 'not_equals', 'Philadelphia'), 2],
			['city contains', filter('city', 'contains', 'burgh'), 1],
			['state equals', filter('state', 'equals', 'NJ'), 1],
			['state not equals', filter('state', 'not_equals', 'NJ'), 3],
			['zip equals', filter('zip_code', 'equals', '19106'), 1],
			['zip starts with', filter('zip_code', 'starts_with', '191'), 2],
			['zip not equals', filter('zip_code', 'not_equals', '19106'), 3],
			['name contains', filter('location_name', 'contains', 'Hall'), 1],
			['name starts with', filter('location_name', 'starts_with', 'Camden'), 1],
			['name equals', filter('location_name', 'equals', 'Liberty Bell'), 1],
			['name not equals', filter('location_name', 'not_equals', 'Liberty Bell'), 3],
			[
				'within 5 miles of the Liberty Bell',
				filter('radius_from_point', 'within', {
					latitude: 39.9496,
					longitude: -75.1503,
					radius: 5
				}),
				3
			],
			[
				'not within 5 miles',
				filter('radius_from_point', 'not_within', {
					latitude: 39.9496,
					longitude: -75.1503,
					radius: 5
				}),
				1
			],
			['inside a drawn region', filter('inside_drawn_region', 'within', square), 3],
			['outside a drawn region', filter('inside_drawn_region', 'not_within', square), 1],
			['never canvassed', filter('canvassed', 'equals', false), 4],
			['canvassed', filter('canvassed', 'equals', true), 0]
		];
		for (const [label, group, expected] of cases) {
			expect(await count(group), label).toBe(expected);
		}

		const either = {
			operator: 'OR' as const,
			filters: [
				filter('state', 'equals', 'NJ').filters[0],
				filter('city', 'equals', 'Pittsburgh').filters[0]
			]
		};
		expect(await count(either), 'OR group').toBe(2);
	});

	test('people filters', async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		await world.importPeople(staff, org, PEOPLE);
		const count = async (people: ReturnType<typeof filter>) =>
			world.bucketCount(
				staff,
				(await world.createBucket(staff, org, { people, locations: null })).id,
				'people'
			);

		const cases: [string, ReturnType<typeof filter>, number][] = [
			['first name equals', filter('first_name', 'equals', 'Ada'), 1],
			['first name starts with', filter('first_name', 'starts_with', 'A'), 2],
			['first name contains', filter('first_name', 'contains', 'rac'), 1],
			['first name not equals', filter('first_name', 'not_equals', 'Ada'), 2],
			['last name equals', filter('last_name', 'equals', 'Hopper'), 1],
			['born before 1980', filter('date_of_birth', 'less_than', '1980-01-01'), 1],
			['born in or after 1990', filter('date_of_birth', 'greater_than_or_equal', '1990-01-01'), 2],
			['younger than 18', filter('age', 'less_than', 18), 1],
			['18 or older', filter('age', 'greater_than_or_equal', 18), 2],
			['has an email', filter('has_email', 'equals', true), 1],
			['has no email', filter('has_email', 'equals', false), 2],
			['has a phone', filter('has_phone', 'equals', true), 1]
		];
		for (const [label, group, expected] of cases) {
			expect(await count(group), label).toBe(expected);
		}
	});
});

test.describe('the bucket API', () => {
	test('renames and refilters a bucket; another org’s bucket answers 404', async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const bucket = await world.createBucket(staff, org);
		const outsider = await world.as(await world.createOrg(), 'admin');

		const res = await staff.request.patch(`/api/v1/buckets/${bucket.id}`, {
			data: { name: 'Renamed' }
		});
		expect(res.status()).toBe(200);
		expect(await res.json()).toMatchObject({ name: 'Renamed' });

		expect((await outsider.request.get(`/api/v1/buckets/${bucket.id}`)).status()).toBe(404);
		expect((await outsider.request.get(`/api/v1/buckets/${bucket.id}/locations`)).status()).toBe(
			404
		);
		expect(
			(
				await outsider.request.patch(`/api/v1/buckets/${bucket.id}`, { data: { name: 'x' } })
			).status()
		).toBe(404);
	});

	test('a volunteer cannot read buckets', async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const bucket = await world.createBucket(staff, org);
		const volunteer = await world.as(org, 'volunteer');

		expect((await volunteer.request.get(`/api/v1/buckets/${bucket.id}`)).status()).toBe(403);
		expect(
			(await volunteer.page.goto(`/o/${org.slug}/s/universe/buckets/${bucket.slug}`))?.status()
		).toBe(403);
	});
});
