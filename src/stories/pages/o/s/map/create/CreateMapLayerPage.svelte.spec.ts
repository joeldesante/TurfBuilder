import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import CreateMapLayerPage from './CreateMapLayerPage.svelte';

test('renders layer name field, geojson upload, and create button', async () => {
	const { getByLabelText, getByRole } = render(CreateMapLayerPage, {
		props: { onCreate: vi.fn() }
	});
	await expect.element(getByLabelText('Layer Name')).toBeVisible();
	await expect.element(getByLabelText('GeoJSON')).toBeVisible();
	await expect.element(getByRole('button', { name: 'Create' })).toBeVisible();
});

test('shows validation errors when submitting an empty form', async () => {
	const onCreate = vi.fn();
	const { getByRole, getByText } = render(CreateMapLayerPage, { props: { onCreate } });

	await getByRole('button', { name: 'Create' }).click();

	await expect.element(getByText('Layer name is required')).toBeVisible();
	await expect.element(getByText('A GeoJSON file is required')).toBeVisible();
	expect(onCreate).not.toHaveBeenCalled();
});

test('calls onCreate with the layer name and uploaded file', async () => {
	const onCreate = vi.fn().mockResolvedValue(undefined);
	const { getByLabelText, getByRole } = render(CreateMapLayerPage, { props: { onCreate } });

	await getByLabelText('Layer Name').fill('District Boundaries');
	const file = new File(['{"type":"FeatureCollection","features":[]}'], 'layer.geojson', {
		type: 'application/geo+json'
	});
	await getByLabelText('GeoJSON').upload(file);
	await getByRole('button', { name: 'Create' }).click();

	await vi.waitFor(() => {
		expect(onCreate).toHaveBeenCalledWith({
			layerName: 'District Boundaries',
			geojson: expect.objectContaining({ name: 'layer.geojson' })
		});
	});
});

test('shows error message when onCreate rejects', async () => {
	const onCreate = vi.fn().mockRejectedValue(new Error('Failed to upload the layer.'));
	const { getByLabelText, getByRole, getByText } = render(CreateMapLayerPage, {
		props: { onCreate }
	});

	await getByLabelText('Layer Name').fill('District Boundaries');
	const file = new File(['{}'], 'layer.geojson', { type: 'application/geo+json' });
	await getByLabelText('GeoJSON').upload(file);
	await getByRole('button', { name: 'Create' }).click();

	await expect.element(getByText('Failed to upload the layer.')).toBeVisible();
});
