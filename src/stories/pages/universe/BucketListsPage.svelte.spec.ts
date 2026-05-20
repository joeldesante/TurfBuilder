import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import BucketListsPage from './BucketListsPage.svelte';

test('renders Lists heading', async () => {
	const { getByRole } = render(BucketListsPage, { props: { bucketName: 'Registered Voters' } });
	await expect.element(getByRole('heading', { name: 'Lists' })).toBeVisible();
});

test('renders bucket name as subheading', async () => {
	const { getByText } = render(BucketListsPage, { props: { bucketName: 'Registered Voters' } });
	await expect.element(getByText('Registered Voters')).toBeVisible();
});
