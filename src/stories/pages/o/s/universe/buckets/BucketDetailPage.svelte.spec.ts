import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import BucketDetailPage from './BucketDetailPage.svelte';

test('renders bucket name as heading', async () => {
	const { getByRole } = render(BucketDetailPage, { props: { name: 'Registered Voters' } });
	await expect.element(getByRole('heading', { name: 'Registered Voters' })).toBeVisible();
});

test('renders description when provided', async () => {
	const { getByText } = render(BucketDetailPage, {
		props: { name: 'Registered Voters', description: 'All registered voters.' }
	});
	await expect.element(getByText('All registered voters.')).toBeVisible();
});
