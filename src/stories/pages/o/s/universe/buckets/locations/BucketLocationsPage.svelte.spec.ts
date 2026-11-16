import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import BucketLocationsPage from './BucketLocationsPage.svelte';

const sampleLocations = [
	{ id: '1', name: 'City Hall', address_line_1: '100 Main St', address_line_2: null, city: 'Springfield', state_or_region: 'IL', postal_code: '62701' },
	{ id: '2', name: null, address_line_1: '42 Oak Ave', address_line_2: 'Apt 3', city: 'Springfield', state_or_region: 'IL', postal_code: '62702' }
];

test('renders heading and bucket name', async () => {
	const { getByRole, getByText } = render(BucketLocationsPage, {
		props: { bucketName: 'Downtown District', enabled: true, locations: sampleLocations }
	});
	await expect.element(getByRole('heading', { name: 'Locations' })).toBeVisible();
	await expect.element(getByText('Downtown District')).toBeVisible();
});

test('shows location rows when results are present', async () => {
	const { getByText } = render(BucketLocationsPage, {
		props: { bucketName: 'Downtown District', enabled: true, locations: sampleLocations }
	});
	// A named location shows its name over the city line; an unnamed one shows
	// its street address instead.
	await expect.element(getByText('City Hall')).toBeVisible();
	await expect.element(getByText('Springfield, IL, 62701')).toBeVisible();
	await expect.element(getByText('42 Oak Ave, Apt 3')).toBeVisible();
});

test('shows match count', async () => {
	const { getByText } = render(BucketLocationsPage, {
		props: { bucketName: 'Downtown District', enabled: true, locations: sampleLocations }
	});
	await expect.element(getByText('2 locations matched')).toBeVisible();
});

test('shows empty state when no locations match', async () => {
	const { getByText } = render(BucketLocationsPage, {
		props: { bucketName: 'Downtown District', enabled: true, locations: [] }
	});
	await expect.element(getByText(/no locations match/i)).toBeVisible();
});

test('shows not-enabled state when locations filter is off', async () => {
	const { getByText } = render(BucketLocationsPage, {
		props: { bucketName: 'People Only', enabled: false, locations: [] }
	});
	await expect.element(getByText(/does not include a locations filter/i)).toBeVisible();
});

test('shows the total across pages, not just the rows on this one', async () => {
	const { getByText } = render(BucketLocationsPage, {
		props: { bucketName: 'Downtown District', enabled: true, locations: sampleLocations, totalCount: 1240, page: 2, pageSize: 2 }
	});
	await expect.element(getByText('1,240 locations matched')).toBeVisible();
	await expect.element(getByText('Showing 3–4 of 1,240 locations.').first()).toBeVisible();
});

test('links to the next page', async () => {
	const { getByRole } = render(BucketLocationsPage, {
		props: { bucketName: 'Downtown District', enabled: true, locations: sampleLocations, totalCount: 1240, page: 2, pageSize: 2 }
	});
	await expect.element(getByRole('link', { name: 'Next page' }).first()).toHaveAttribute('href', '?page=3');
});

test('shows page controls above and below the list', async () => {
	const { getByRole } = render(BucketLocationsPage, {
		props: { bucketName: 'Downtown District', enabled: true, locations: sampleLocations, totalCount: 1240, page: 2, pageSize: 2 }
	});
	await expect.element(getByRole('navigation', { name: 'Pagination' }).first()).toBeVisible();
	await expect.element(getByRole('navigation', { name: 'Pagination' }).nth(1)).toBeVisible();
});

test('offers List and Map tabs, with List current', async () => {
	const { getByRole } = render(BucketLocationsPage, {
		props: { bucketName: 'Downtown District', enabled: true, locations: sampleLocations, basePath: '/b/locations' }
	});

	await expect.element(getByRole('link', { name: 'List' })).toHaveAttribute('aria-current', 'page');
	await expect.element(getByRole('link', { name: 'Map' })).toHaveAttribute('href', '/b/locations?view=map');
});

test('offers no tabs when the bucket has no locations filter', async () => {
	const { getByRole } = render(BucketLocationsPage, {
		props: { bucketName: 'Downtown District', enabled: false, locations: [] }
	});

	await expect.element(getByRole('link', { name: 'Map' })).not.toBeInTheDocument();
});

test('switches view through onViewChange when given, so the route can show the loader', async () => {
	const onViewChange = vi.fn();
	const { getByRole } = render(BucketLocationsPage, {
		props: { bucketName: 'Downtown District', enabled: true, locations: sampleLocations, onViewChange }
	});

	await getByRole('button', { name: 'Map' }).click();

	expect(onViewChange).toHaveBeenCalledWith('map');
	await expect.element(getByRole('link', { name: 'Map' })).not.toBeInTheDocument();
});
