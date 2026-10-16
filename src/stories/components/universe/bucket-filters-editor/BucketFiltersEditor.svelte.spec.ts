import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import BucketFiltersEditor from './BucketFiltersEditor.svelte';
import type { BucketFilters } from '$lib/shared/types/filters';

const none: BucketFilters = { v: 2, people: null, locations: null };
const austin: BucketFilters = {
	v: 2,
	people: null,
	locations: { operator: 'AND', filters: [{ item: 'city', operation: 'equals', value: 'Austin' }] }
};

test('shows an editor only for each kind of record the bucket includes', async () => {
	const { getByRole } = render(BucketFiltersEditor, { props: { filters: austin } });

	await expect.element(getByRole('region', { name: 'Locations filters' })).toBeVisible();
	await expect.element(getByRole('region', { name: 'People filters' })).not.toBeInTheDocument();
	await expect.element(getByRole('checkbox', { name: 'Locations' })).toBeChecked();
});

test('does not offer people, which are not supported yet', async () => {
	const { getByRole } = render(BucketFiltersEditor, { props: { filters: none } });

	await expect.element(getByRole('checkbox', { name: 'Locations' })).toBeVisible();
	await expect.element(getByRole('checkbox', { name: 'People' })).not.toBeInTheDocument();
});

test('shows the filters the bucket already has as sentences', async () => {
	const { getByText } = render(BucketFiltersEditor, { props: { filters: austin } });

	await expect.element(getByText(/Locations whose city is Austin/)).toBeVisible();
});

test('says what the bucket will contain', async () => {
	const { getByText } = render(BucketFiltersEditor, { props: { filters: austin } });

	await expect.element(getByText('This bucket will contain')).toBeVisible();
});

test('ticking a kind of record adds an empty editor for it', async () => {
	const { getByRole } = render(BucketFiltersEditor, { props: { filters: none } });

	await getByRole('checkbox', { name: 'Locations' }).click();

	await expect.element(getByRole('region', { name: 'Locations filters' })).toBeVisible();
});

test('unticking a kind removes its editor, and ticking it again brings its filters back', async () => {
	const { getByRole, getByText } = render(BucketFiltersEditor, { props: { filters: austin } });

	await getByRole('checkbox', { name: 'Locations' }).click();
	await expect.element(getByRole('region', { name: 'Locations filters' })).not.toBeInTheDocument();

	await getByRole('checkbox', { name: 'Locations' }).click();
	await expect.element(getByText(/Locations whose city is Austin/)).toBeVisible();
});

test('changes made in an editor update the bound filters', async () => {
	const { getByRole, getByText } = render(BucketFiltersEditor, { props: { filters: austin } });

	await getByRole('button', { name: 'Edit filter' }).click();
	await getByRole('textbox', { name: 'Value' }).fill('Dallas');
	await getByRole('button', { name: 'Save' }).click();

	await expect.element(getByText(/city is Dallas/)).toBeVisible();
});

test('offers each kind only its own filters', async () => {
	const { getByRole } = render(BucketFiltersEditor, { props: { filters: austin } });

	await getByRole('button', { name: 'Add Filter' }).click();

	await expect.element(getByRole('button', { name: /^City/ })).toBeVisible();
	await expect.element(getByRole('button', { name: /^Age/ })).not.toBeInTheDocument();
});
