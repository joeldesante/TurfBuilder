import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import BucketEntityFilterEditor from './BucketEntityFilterEditor.svelte';

test('renders entity name in heading', async () => {
	const { getByRole } = render(BucketEntityFilterEditor, { props: { entity: 'People' } });
	await expect.element(getByRole('heading')).toHaveTextContent('People');
});

test('renders entity name in filter sentence', async () => {
	const { getByText } = render(BucketEntityFilterEditor, { props: { entity: 'Locations' } });
	await expect.element(getByText(/show me locations that match/i)).toBeVisible();
});

test('defaults match type to ONE OR MORE', async () => {
	const { getByRole } = render(BucketEntityFilterEditor, { props: { entity: 'People' } });
	const select = getByRole('combobox');
	await expect.element(select).toHaveValue('ONE_OR_MORE');
});

test('respects matchType prop', async () => {
	const { getByRole } = render(BucketEntityFilterEditor, {
		props: { entity: 'People', matchType: 'ALL' }
	});
	const select = getByRole('combobox');
	await expect.element(select).toHaveValue('ALL');
});

test('renders Add Filter button', async () => {
	const { getByRole } = render(BucketEntityFilterEditor, { props: { entity: 'People' } });
	await expect.element(getByRole('button', { name: 'Add Filter' })).toBeVisible();
});
