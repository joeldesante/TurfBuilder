import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from '@vitest/browser/context';
import LayerDialog from './LayerDialog.svelte';
import { LAYER_COLORS } from '$lib/shared/utils/layer-colors';

const collection = JSON.stringify({ type: 'FeatureCollection', features: [] });
const wards = JSON.stringify({
	type: 'FeatureCollection',
	features: [
		{ type: 'Feature', geometry: null, properties: { ward_num: 1, name: 'First' } },
		{ type: 'Feature', geometry: null, properties: { ward_num: 2, name: 'Second' } }
	]
});
const geojson = (body = collection, name = 'parks.geojson') =>
	new File([body], name, { type: 'application/geo+json' });

function open(props: Record<string, unknown> = {}) {
	const onSave = vi.fn();
	const onClose = vi.fn();
	render(LayerDialog, { props: { open: true, onSave, onClose, ...props } });
	return { onSave, onClose };
}

/** The catalogue is the default source; the file tests switch to the drop zone first. */
async function chooseLocalFile() {
	await page.getByRole('radio', { name: 'Local File' }).click();
}

describe('LayerDialog adding', () => {
	it('shows a drop zone for GeoJSON when open', async () => {
		open();

		await expect.element(page.getByRole('dialog', { name: 'Add Layer' })).toBeVisible();
		await chooseLocalFile();
		await expect.element(page.getByText('Drop a GeoJSON file here')).toBeVisible();
		await expect
			.element(page.getByTestId('file-dropzone-input'))
			.toHaveAttribute('accept', '.geojson,.json,application/geo+json,application/json');
	});

	it('renders nothing when closed', async () => {
		open({ open: false });

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('starts on the source step, with no details to fill in', async () => {
		open();

		await expect.element(page.getByRole('heading', { name: 'Add Layer' })).toBeVisible();
		await expect.element(page.getByLabelText('Layer name')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Add layer' })).not.toBeInTheDocument();
	});

	it('moves to the details step once a file is read, and back again', async () => {
		open();

		await chooseLocalFile();
		await userEvent.upload(page.getByTestId('file-dropzone-input'), geojson());
		await expect.element(page.getByText('From parks.geojson')).toBeVisible();

		await page.getByRole('button', { name: 'Back' }).click();
		await expect.element(page.getByRole('heading', { name: 'Add Layer' })).toBeVisible();
		await expect.element(page.getByLabelText('Layer name')).not.toBeInTheDocument();
	});

	it('names the layer after the file and uses the default color', async () => {
		const { onSave, onClose } = open({ defaultColor: '#8a4fd6' });

		await chooseLocalFile();
		await userEvent.upload(page.getByTestId('file-dropzone-input'), geojson());
		await expect.element(page.getByLabelText('Layer name')).toHaveValue('parks');
		await page.getByRole('button', { name: 'Add layer' }).click();

		expect(onSave).toHaveBeenCalledWith({
			name: 'parks',
			color: '#8a4fd6',
			labelField: null,
			geojson: { type: 'FeatureCollection', features: [] }
		});
		expect(onClose).toHaveBeenCalled();
	});

	it('uses the name and color that were chosen', async () => {
		const { onSave } = open();

		await chooseLocalFile();
		await userEvent.upload(page.getByTestId('file-dropzone-input'), geojson());
		await page.getByLabelText('Layer name').fill('City parks');
		await page.getByRole('radio', { name: 'Pink' }).click();
		await page.getByRole('button', { name: 'Add layer' }).click();

		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'City parks', color: '#e4569c' })
		);
	});

	it('lets the label come from one of the file properties', async () => {
		const { onSave } = open();

		await chooseLocalFile();
		await userEvent.upload(page.getByTestId('file-dropzone-input'), geojson(wards));
		await expect.element(page.getByLabelText('Label field')).toHaveTextContent('No label');
		await page.getByLabelText('Label field').click();
		await page.getByRole('option', { name: 'ward_num' }).click();
		await page.getByRole('button', { name: 'Add layer' }).click();

		expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ labelField: 'ward_num' }));
	});

	it('has no label field to pick when the file has no properties', async () => {
		open();

		await chooseLocalFile();
		await userEvent.upload(page.getByTestId('file-dropzone-input'), geojson());

		await expect.element(page.getByLabelText('Label field')).toBeDisabled();
	});

	it('refuses a file that is not GeoJSON', async () => {
		const { onSave } = open();

		await chooseLocalFile();
		await userEvent.upload(
			page.getByTestId('file-dropzone-input'),
			geojson(JSON.stringify({ hello: 'world' }))
		);

		await expect.element(page.getByRole('alert')).toHaveTextContent('not GeoJSON');
		expect(onSave).not.toHaveBeenCalled();
	});

	it('refuses a file that is not JSON', async () => {
		open();

		await chooseLocalFile();
		await userEvent.upload(page.getByTestId('file-dropzone-input'), geojson('nope'));

		await expect.element(page.getByRole('alert')).toHaveTextContent('not valid JSON');
	});

	it('calls onClose from Cancel', async () => {
		const { onClose } = open();

		await page.getByRole('button', { name: 'Cancel' }).click();

		expect(onClose).toHaveBeenCalled();
	});
});

describe('LayerDialog catalogue', () => {
	afterEach(() => vi.unstubAllGlobals());

	const wardData = {
		type: 'FeatureCollection',
		features: [{ type: 'Feature', geometry: null, properties: { BASENAME: '1' } }]
	};
	const pointData = {
		type: 'FeatureCollection',
		features: [
			{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } },
			{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [1, 1] } }
		]
	};

	/** Searches answer with one point layer from ArcGIS Hub; loading a layer answers with `layer`. */
	function stubNetwork(layer: unknown, loadOk = true) {
		const json = (body: unknown, ok = true) =>
			Promise.resolve({ ok, status: ok ? 200 : 500, text: () => Promise.resolve(JSON.stringify(body)), json: () => Promise.resolve(body) });
		vi.stubGlobal('fetch', (input: string) => {
			const url = String(input);
			if (url.includes('opendataphilly.org/datasets.json')) return json([]);
			if (url.includes('hub.arcgis.com')) {
				return json({
					data: [
						{
							id: 'housing_0',
							attributes: {
								name: 'Public housing developments',
								source: 'HUD',
								geometryType: 'esriGeometryPoint',
								recordCount: 40,
								fields: [],
								url: 'https://services.example.com/arcgis/rest/services/Housing/FeatureServer/0'
							}
						}
					],
					meta: { page: { nextStart: 99 }, total: 1 }
				});
			}
			if (url.includes('api.us.socrata.com')) return json({ results: [], resultSetSize: 0 });
			if (url.includes('/layer-catalogue/ckan')) return json({ entries: [], hasMore: false, next: null });
			if (url.includes('/layer-catalogue/data-gov')) return json({ entries: [], hasMore: false, next: null });
			return json(layer, loadOk);
		});
	}

	it('opens on the catalogue, listed first', async () => {
		stubNetwork(wardData);
		open();

		await expect.element(page.getByRole('radio', { name: 'Catalogue' })).toBeChecked();
		await expect.element(page.getByRole('searchbox', { name: 'Search layers' })).toBeVisible();
		await expect.element(page.getByText('Drop a GeoJSON file here')).not.toBeInTheDocument();
	});

	it('adds a layer picked from the catalogue, named and labelled for it', async () => {
		stubNetwork(wardData);
		const { onSave } = open({ getViewBounds: () => [-75.3, 39.85, -74.95, 40.15] });

		await page.getByRole('listitem', { name: /Congressional districts/ }).click();

		await expect.element(page.getByLabelText('Layer name')).toHaveValue('Congressional districts');
		const source = page.getByRole('link', { name: /US Census Bureau/ });
		await expect.element(source).toHaveAttribute('target', '_blank');
		await expect.element(source).toHaveAttribute('href', /tigerweb\.geo\.census\.gov/);
		await expect.element(page.getByLabelText('Label field')).toHaveTextContent('BASENAME');
		await page.getByRole('button', { name: 'Add layer' }).click();

		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Congressional districts', labelField: 'BASENAME', geojson: wardData })
		);
	});

	it('shows what the loaded layer is made of', async () => {
		stubNetwork(pointData);
		open({ getViewBounds: () => [-75.3, 39.85, -74.95, 40.15] });

		await userEvent.fill(page.getByRole('searchbox', { name: 'Search layers' }), 'housing');
		await page.getByRole('listitem', { name: /Public housing developments/ }).click();

		await expect.element(page.getByText('Points (2)')).toBeVisible();
	});

	it('shows a message when the layer cannot be loaded', async () => {
		stubNetwork({}, false);
		const { onSave } = open({ getViewBounds: () => [-75.3, 39.85, -74.95, 40.15] });

		await page.getByRole('listitem', { name: /Congressional districts/ }).click();

		await expect.element(page.getByRole('alert')).toHaveTextContent('did not return the layer');
		await expect.element(page.getByText('Step 1 of 2')).toBeVisible();
		expect(onSave).not.toHaveBeenCalled();
	});
});

describe('LayerDialog editing', () => {
	const layer = {
		name: 'City parks',
		color: LAYER_COLORS[3].value,
		labelField: 'name',
		geojson: JSON.parse(wards)
	};

	it('starts with the layer name and color, and no drop zone', async () => {
		open({ layer });

		await expect.element(page.getByRole('dialog', { name: 'Edit Layer' })).toBeVisible();
		await expect.element(page.getByLabelText('Layer name')).toHaveValue('City parks');
		await expect.element(page.getByRole('radio', { name: 'Green' })).toBeChecked();
		await expect.element(page.getByLabelText('Label field')).toHaveTextContent('name');
		await expect.element(page.getByText('Drop a GeoJSON file here')).not.toBeInTheDocument();
	});

	it('saves a new name and color without a file', async () => {
		const { onSave, onClose } = open({ layer });

		await page.getByLabelText('Layer name').fill('Parks');
		await page.getByRole('radio', { name: 'Red' }).click();
		await page.getByLabelText('Label field').click();
		await page.getByRole('option', { name: 'No label' }).click();
		await page.getByRole('button', { name: 'Save' }).click();

		expect(onSave).toHaveBeenCalledWith({
			name: 'Parks',
			color: '#e63946',
			labelField: null,
			geojson: null
		});
		expect(onClose).toHaveBeenCalled();
	});
});
