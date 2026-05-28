import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import ListDetailPage from './ListDetailPage.svelte';

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const baseList = {
	id: 'list-1',
	name: 'Ward 3 Doors',
	entity_type: 'people',
	expires_at: futureDate,
	created_at: new Date().toISOString()
};

const baseProps = {
	orgSlug: 'test-org',
	bucketName: 'Registered Voters',
	bucketSlug: 'registered-voters',
	listHref: '/o/test-org/s/universe/buckets/registered-voters/lists/list-1',
	list: baseList,
	entries: [],
	turfs: []
};

const sampleTurfs = [
	{
		id: 'turf-1',
		code: 'AB12CD',
		expires_at: futureDate,
		created_at: new Date().toISOString(),
		author: 'jdoe',
		survey_name: 'Door Knock Survey',
		location_count: '14'
	},
	{
		id: 'turf-2',
		code: 'XY34ZW',
		expires_at: pastDate,
		created_at: new Date().toISOString(),
		author: 'asmith',
		survey_name: null,
		location_count: '7'
	}
];

const peopleEntries = [
	{
		record_id: 'rec-a',
		record_source: 'org_person',
		entity_id: 'ent-a',
		first_name: 'Alice',
		last_name: 'Nguyen',
		email: 'alice@example.com',
		phone: '555-1234'
	},
	{
		record_id: 'rec-b',
		record_source: 'org_person',
		entity_id: 'ent-b',
		first_name: 'Bob',
		last_name: 'Smith',
		email: null,
		phone: null
	}
];

test('renders list name as heading', async () => {
	const { getByRole } = render(ListDetailPage, { props: baseProps });
	await expect.element(getByRole('heading', { name: 'Ward 3 Doors' })).toBeVisible();
});

test('renders bucket name as subheading', async () => {
	const { getByText } = render(ListDetailPage, { props: baseProps });
	await expect.element(getByText('Registered Voters')).toBeVisible();
});

test('renders entity type for people', async () => {
	const { getByText } = render(ListDetailPage, { props: baseProps });
	await expect.element(getByText('People')).toBeVisible();
});

test('renders entity type for locations', async () => {
	const { container } = render(ListDetailPage, {
		props: { ...baseProps, list: { ...baseList, entity_type: 'locations' } }
	});
	expect(container.textContent).toContain('Locations');
});

test('renders entry count badge', async () => {
	const { container } = render(ListDetailPage, {
		props: { ...baseProps, entries: peopleEntries }
	});
	expect(container.textContent).toContain('2');
});

test('renders empty state', async () => {
	const { getByText } = render(ListDetailPage, { props: baseProps });
	await expect.element(getByText('No entries in this list.')).toBeVisible();
});

test('renders people rows with name and email', async () => {
	const { getByText } = render(ListDetailPage, {
		props: { ...baseProps, entries: peopleEntries }
	});
	await expect.element(getByText('Alice Nguyen')).toBeVisible();
	await expect.element(getByText('alice@example.com')).toBeVisible();
	await expect.element(getByText('Bob Smith')).toBeVisible();
});

test('entry rows link to entity detail page with version and prevPage', async () => {
	const { getByRole } = render(ListDetailPage, {
		props: { ...baseProps, entries: peopleEntries }
	});
	const link = getByRole('link', { name: /Alice Nguyen/i });
	const expectedPrevPage = encodeURIComponent('/o/test-org/s/universe/buckets/registered-voters/lists/list-1');
	await expect.element(link).toHaveAttribute(
		'href',
		`/o/test-org/s/universe/entity/ent-a?version=rec-a&backHref=${expectedPrevPage}`
	);
});

test('renders dash for missing email', async () => {
	const { container } = render(ListDetailPage, {
		props: { ...baseProps, entries: peopleEntries }
	});
	const cells = container.querySelectorAll('a span, a div');
	const hasDash = Array.from(cells).some((el) => el.textContent?.trim() === '—');
	expect(hasDash).toBe(true);
});

test('renders expired label when list is expired', async () => {
	const { getByText } = render(ListDetailPage, {
		props: { ...baseProps, list: { ...baseList, expires_at: pastDate } }
	});
	await expect.element(getByText(/Expired/)).toBeVisible();
});

test('renders location rows', async () => {
	const locationEntries = [
		{
			record_id: 'rec-x',
			record_source: 'org_location',
			entity_id: 'ent-x',
			name: 'City Hall',
			address_line_1: '100 Main St',
			city: 'Springfield',
			state_or_region: 'IL',
			postal_code: '62701'
		}
	];
	const { getByText } = render(ListDetailPage, {
		props: {
			...baseProps,
			list: { ...baseList, entity_type: 'locations' },
			entries: locationEntries
		}
	});
	await expect.element(getByText('City Hall')).toBeVisible();
	await expect.element(getByText('Springfield')).toBeVisible();
});

test('turfs section not shown for people lists', async () => {
	const { container } = render(ListDetailPage, { props: baseProps });
	expect(container.textContent).not.toContain('No turfs cut yet.');
});

test('renders turfs empty state for location list with no turfs', async () => {
	const { getByRole, getByText } = render(ListDetailPage, {
		props: { ...baseProps, list: { ...baseList, entity_type: 'locations' } }
	});
	await getByRole('button', { name: /Turfs/ }).click();
	await expect.element(getByText('No turfs cut yet.')).toBeVisible();
});

test('renders turf codes in turfs section', async () => {
	const { getByRole, getByText } = render(ListDetailPage, {
		props: {
			...baseProps,
			list: { ...baseList, entity_type: 'locations' },
			turfs: sampleTurfs
		}
	});
	await getByRole('button', { name: /Turfs/ }).click();
	await expect.element(getByText('AB12CD')).toBeVisible();
	await expect.element(getByText('XY34ZW')).toBeVisible();
});

test('renders turf survey name and author', async () => {
	const { getByRole, getByText } = render(ListDetailPage, {
		props: {
			...baseProps,
			list: { ...baseList, entity_type: 'locations' },
			turfs: sampleTurfs
		}
	});
	await getByRole('button', { name: /Turfs/ }).click();
	await expect.element(getByText('Door Knock Survey')).toBeVisible();
	await expect.element(getByText('jdoe')).toBeVisible();
});

test('renders Expired for expired turfs', async () => {
	const { getByRole, container } = render(ListDetailPage, {
		props: {
			...baseProps,
			list: { ...baseList, entity_type: 'locations' },
			turfs: sampleTurfs
		}
	});
	await getByRole('button', { name: /Turfs/ }).click();
	expect(container.textContent).toContain('Expired');
});
