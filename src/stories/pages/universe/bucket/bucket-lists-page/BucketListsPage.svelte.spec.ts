import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import BucketListsPage from './BucketListsPage.svelte';

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const baseProps = {
	bucketName: 'Registered Voters',
	bucketSlug: 'registered-voters',
	orgSlug: 'test-org',
	lists: [],
	createHref: '/o/test-org/s/universe/buckets/registered-voters/lists/new'
};

test('renders Lists heading', async () => {
	const { getByRole } = render(BucketListsPage, { props: baseProps });
	await expect.element(getByRole('heading', { name: 'Lists' })).toBeVisible();
});

test('renders bucket name as subheading', async () => {
	const { getByText } = render(BucketListsPage, { props: baseProps });
	await expect.element(getByText('Registered Voters')).toBeVisible();
});

test('renders New List button', async () => {
	const { getByRole } = render(BucketListsPage, { props: baseProps });
	await expect.element(getByRole('link', { name: /New List/i })).toBeVisible();
});

test('renders empty state when no lists', async () => {
	const { getByText } = render(BucketListsPage, { props: baseProps });
	await expect.element(getByText('No lists yet.')).toBeVisible();
});

test('renders list rows', async () => {
	const { getByText } = render(BucketListsPage, {
		props: {
			...baseProps,
			lists: [
				{
					id: '1',
					name: 'Ward 3 Doors',
					entity_type: 'people',
					expires_at: futureDate,
					created_at: new Date().toISOString(),
					entry_count: 142
				}
			]
		}
	});
	await expect.element(getByText('Ward 3 Doors')).toBeVisible();
});

test('hides expired lists by default — shows all-expired message', async () => {
	const { getByText } = render(BucketListsPage, {
		props: {
			...baseProps,
			lists: [
				{
					id: '1',
					name: 'Old Expired List',
					entity_type: 'people',
					expires_at: pastDate,
					created_at: new Date().toISOString(),
					entry_count: 5
				}
			]
		}
	});
	// The expired item is hidden; the "all expired" fallback message shows instead.
	await expect.element(getByText('All lists have expired.')).toBeVisible();
});

test('active lists are visible, expired are not shown', async () => {
	const { getByText, container } = render(BucketListsPage, {
		props: {
			...baseProps,
			lists: [
				{
					id: '1',
					name: 'Active List',
					entity_type: 'people',
					expires_at: futureDate,
					created_at: new Date().toISOString(),
					entry_count: 10
				},
				{
					id: '2',
					name: 'Expired Hidden List',
					entity_type: 'people',
					expires_at: pastDate,
					created_at: new Date().toISOString(),
					entry_count: 5
				}
			]
		}
	});
	await expect.element(getByText('Active List')).toBeVisible();
	const expiredEl = container.querySelector('a[href*="lists/2"]');
	expect(expiredEl).toBeNull();
});

test('shows expired lists when checkbox is checked', async () => {
	const { getByText, getByRole } = render(BucketListsPage, {
		props: {
			...baseProps,
			lists: [
				{
					id: '1',
					name: 'Old Expired List',
					entity_type: 'people',
					expires_at: pastDate,
					created_at: new Date().toISOString(),
					entry_count: 5
				}
			]
		}
	});

	const checkbox = getByRole('checkbox', { name: /Show expired lists/i });
	await checkbox.click();
	await expect.element(getByText('Old Expired List')).toBeVisible();
});

test('renders entity type label for people', async () => {
	const { getByText } = render(BucketListsPage, {
		props: {
			...baseProps,
			lists: [
				{
					id: '1',
					name: 'My List',
					entity_type: 'people',
					expires_at: futureDate,
					created_at: new Date().toISOString(),
					entry_count: 0
				}
			]
		}
	});
	await expect.element(getByText('People')).toBeVisible();
});

test('renders entity type label for locations', async () => {
	const { getByText } = render(BucketListsPage, {
		props: {
			...baseProps,
			lists: [
				{
					id: '1',
					name: 'My List',
					entity_type: 'locations',
					expires_at: futureDate,
					created_at: new Date().toISOString(),
					entry_count: 0
				}
			]
		}
	});
	await expect.element(getByText('Locations')).toBeVisible();
});

test('renders show expired lists checkbox', async () => {
	const { getByRole } = render(BucketListsPage, { props: baseProps });
	await expect.element(getByRole('checkbox', { name: /Show expired lists/i })).toBeVisible();
});
