import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import BucketScriptsPage from './BucketScriptsPage.svelte';

const baseProps = {
	bucketName: 'Registered Voters',
	bucketSlug: 'registered-voters',
	orgSlug: 'test-org',
	scripts: [],
	createHref: '/o/test-org/s/universe/buckets/registered-voters/scripts/new'
};

test('renders Scripts heading', async () => {
	const { getByRole } = render(BucketScriptsPage, { props: baseProps });
	await expect.element(getByRole('heading', { name: 'Scripts' })).toBeVisible();
});

test('renders bucket name as subheading', async () => {
	const { getByText } = render(BucketScriptsPage, { props: baseProps });
	await expect.element(getByText('Registered Voters')).toBeVisible();
});

test('renders empty state when no scripts', async () => {
	const { getByText } = render(BucketScriptsPage, { props: baseProps });
	await expect.element(getByText('No scripts yet.')).toBeVisible();
});

test('renders script rows', async () => {
	const { getByText } = render(BucketScriptsPage, {
		props: {
			...baseProps,
			scripts: [{ id: '1', name: 'Door Knock Script', updated_at: new Date().toISOString() }]
		}
	});
	await expect.element(getByText('Door Knock Script')).toBeVisible();
});
