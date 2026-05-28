import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
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
	await expect.element(getByText('City Hall')).toBeVisible();
	await expect.element(getByText('100 Main St')).toBeVisible();
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
