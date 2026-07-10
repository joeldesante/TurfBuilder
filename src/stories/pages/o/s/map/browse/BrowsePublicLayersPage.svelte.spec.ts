import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import BrowsePublicLayersPage from './BrowsePublicLayersPage.svelte';

const sampleLayers = [
	{ id: 'district-boundaries', label: 'District Boundaries', description: 'District outlines.' },
	{ id: 'polling-places', label: 'Polling Places' }
];

test('renders search input and layer rows with add buttons', async () => {
	const { getByRole, getByText } = render(BrowsePublicLayersPage, {
		props: { layers: sampleLayers, onAdd: vi.fn() }
	});
	await expect.element(getByRole('searchbox', { name: 'Search layers' })).toBeVisible();
	await expect.element(getByText('District Boundaries')).toBeVisible();
	await expect.element(getByText('Polling Places')).toBeVisible();
	expect(getByRole('button', { name: 'Add' }).elements()).toHaveLength(2);
});

test('filters layers by search query', async () => {
	const { getByRole, getByText } = render(BrowsePublicLayersPage, {
		props: { layers: sampleLayers, onAdd: vi.fn() }
	});

	await getByRole('searchbox', { name: 'Search layers' }).fill('polling');

	await expect.element(getByText('Polling Places')).toBeVisible();
	expect(getByText('District Boundaries').elements()).toHaveLength(0);
});

test('shows a no-match message when the search has no results', async () => {
	const { getByRole, getByText } = render(BrowsePublicLayersPage, {
		props: { layers: sampleLayers, onAdd: vi.fn() }
	});

	await getByRole('searchbox', { name: 'Search layers' }).fill('nothing matches this');

	await expect.element(getByText('No layers match your search.')).toBeVisible();
});

test('shows an empty state when there are no layers', async () => {
	const { getByText } = render(BrowsePublicLayersPage, {
		props: { layers: [], onAdd: vi.fn() }
	});
	await expect.element(getByText('No public layers are available yet.')).toBeVisible();
});

test('calls onAdd with the layer and marks it as added', async () => {
	const onAdd = vi.fn().mockResolvedValue(undefined);
	const { getByRole } = render(BrowsePublicLayersPage, {
		props: { layers: [sampleLayers[0]], onAdd }
	});

	await getByRole('button', { name: 'Add' }).click();

	await expect.element(getByRole('button', { name: 'Added' })).toBeDisabled();
	expect(onAdd).toHaveBeenCalledWith(sampleLayers[0]);
});

test('shows error message when onAdd rejects', async () => {
	const onAdd = vi.fn().mockRejectedValue(new Error('Failed to add the layer.'));
	const { getByRole, getByText } = render(BrowsePublicLayersPage, {
		props: { layers: [sampleLayers[0]], onAdd }
	});

	await getByRole('button', { name: 'Add' }).click();

	await expect.element(getByText('Failed to add the layer.')).toBeVisible();
	await expect.element(getByRole('button', { name: 'Add' })).toBeVisible();
});
