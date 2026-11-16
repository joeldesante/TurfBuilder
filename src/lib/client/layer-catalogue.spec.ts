import { describe, expect, it, vi } from 'vitest';
import {
	arcgisQueryUrl,
	CatalogueError,
	loadCatalogueLayer,
	MAX_FEATURES,
	PAGE_SIZE
} from './layer-catalogue';
import { CENSUS_ENTRIES, type CatalogueEntry } from '$lib/shared/registries/layer-catalogue';

const collection = (count: number) => ({
	type: 'FeatureCollection',
	features: Array.from({ length: count }, () => ({ type: 'Feature', geometry: null, properties: {} }))
});
const reply = (body: unknown, ok = true) =>
	Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

const viewport: CatalogueEntry = {
	id: 'x',
	provider: 'hub',
	official: false,
	count: null,
	sourceUrl: null,
	publisher: 'p',
	name: 'n',
	description: 'd',
	labelField: 'f',
	geometry: 'polygon',
	source: { type: 'arcgis', layerUrl: 'https://example.test/Layer/0', scope: 'viewport' }
};
const whole: CatalogueEntry = { ...viewport, source: { ...viewport.source, scope: 'all' } as never };
const file: CatalogueEntry = {
	...viewport,
	source: { type: 'url', url: 'https://example.test/file.geojson' }
};

describe('arcgisQueryUrl', () => {
	it('asks for GeoJSON in WGS84, one page at a time', () => {
		const url = new URL(arcgisQueryUrl('https://example.test/Layer/0', 2000, null));
		expect(url.pathname).toBe('/Layer/0/query');
		expect(url.searchParams.get('f')).toBe('geojson');
		expect(url.searchParams.get('outSR')).toBe('4326');
		expect(url.searchParams.get('resultOffset')).toBe('2000');
		expect(url.searchParams.get('geometry')).toBeNull();
	});

	it('limits the query to a box when given one', () => {
		const url = new URL(arcgisQueryUrl('https://example.test/Layer/0', 0, [-75.3, 39.8, -74.9, 40.1]));
		expect(url.searchParams.get('geometry')).toBe('-75.3,39.8,-74.9,40.1');
		expect(url.searchParams.get('geometryType')).toBe('esriGeometryEnvelope');
	});
});

describe('loadCatalogueLayer', () => {
	it('fetches a plain GeoJSON file once', async () => {
		const fetcher = vi.fn(() => reply(collection(3)));
		const result = await loadCatalogueLayer(file, null, fetcher as never);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(result.geojson.features).toHaveLength(3);
		expect(result.truncated).toBe(false);
	});

	it('reads every page of an ArcGIS layer', async () => {
		const pages = [collection(PAGE_SIZE), collection(PAGE_SIZE), collection(40)];
		const fetcher = vi.fn(() => reply(pages.shift()));
		const result = await loadCatalogueLayer(whole, null, fetcher as never);
		expect(fetcher).toHaveBeenCalledTimes(3);
		expect(result.geojson.features).toHaveLength(PAGE_SIZE * 2 + 40);
		expect(result.truncated).toBe(false);
	});

	it('stops at the limit and says the layer was cut short', async () => {
		const fetcher = vi.fn(() => reply(collection(PAGE_SIZE)));
		const result = await loadCatalogueLayer(whole, null, fetcher as never);
		expect(result.geojson.features).toHaveLength(MAX_FEATURES);
		expect(result.truncated).toBe(true);
	});

	it('loads from the map view when something is in it', async () => {
		const fetcher = vi.fn<(url: string) => Promise<Response>>(() => reply(collection(5)));
		const result = await loadCatalogueLayer(viewport, [-75.3, 39.8, -74.9, 40.1], fetcher as never);

		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('geometry')).toBe('-75.3,39.8,-74.9,40.1');
		expect(result.outsideView).toBe(false);
	});

	it('loads the layer from elsewhere when nothing is in the map view, instead of failing', async () => {
		const answers = [collection(0), collection(7)];
		const fetcher = vi.fn<(url: string) => Promise<Response>>(() => reply(answers.shift()));
		const result = await loadCatalogueLayer(viewport, [0, 0, 1, 1], fetcher as never);

		expect(result.geojson.features).toHaveLength(7);
		expect(result.outsideView).toBe(true);
		expect(new URL(fetcher.mock.calls[0][0]).searchParams.has('geometry')).toBe(true);
		expect(new URL(fetcher.mock.calls[1][0]).searchParams.has('geometry')).toBe(false);
	});

	it('loads the layer whole when there is no map view', async () => {
		const fetcher = vi.fn<(url: string) => Promise<Response>>(() => reply(collection(4)));
		const result = await loadCatalogueLayer(viewport, null, fetcher as never);

		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(new URL(fetcher.mock.calls[0][0]).searchParams.has('geometry')).toBe(false);
		expect(result.outsideView).toBe(false);
	});

	it('only fails when the layer has no shapes at all', async () => {
		await expect(
			loadCatalogueLayer(viewport, [0, 0, 1, 1], (() => reply(collection(0))) as never)
		).rejects.toThrow('This layer has no shapes.');
	});

	it('gives a safe message when the source fails', async () => {
		await expect(
			loadCatalogueLayer(file, null, (() => reply({}, false)) as never)
		).rejects.toThrow('did not return the layer');
		await expect(
			loadCatalogueLayer(file, null, (() => Promise.reject(new Error('secret'))) as never)
		).rejects.toThrow('could not be reached');
	});

	it('rejects a reply that is not a feature collection', async () => {
		await expect(
			loadCatalogueLayer(file, null, (() => reply({ error: { code: 400 } })) as never)
		).rejects.toThrow('did not return any shapes');
	});
});

describe('loadCatalogueLayer from Socrata', () => {
	const socrata: CatalogueEntry = {
		...viewport,
		source: {
			type: 'socrata',
			domain: 'data.example.gov',
			dataset: 'abcd-1234',
			geoColumn: 'the_geom',
			scope: 'viewport'
		}
	};

	it('asks only for the shapes inside the map view', async () => {
		const fetcher = vi.fn<(url: string) => Promise<Response>>(() => reply(collection(2)));
		await loadCatalogueLayer(socrata, [-75.3, 39.8, -74.9, 40.1], fetcher as never);

		const url = new URL(fetcher.mock.calls[0][0]);
		expect(url.origin + url.pathname).toBe('https://data.example.gov/resource/abcd-1234.geojson');
		expect(url.searchParams.get('$where')).toBe('within_box(the_geom, 40.1, -75.3, 39.8, -74.9)');
		expect(url.searchParams.get('$limit')).toBe(String(MAX_FEATURES));
	});

	it('loads a whole dataset when its scope says so', async () => {
		const fetcher = vi.fn<(url: string) => Promise<Response>>(() => reply(collection(2)));
		const whole = { ...socrata, source: { ...socrata.source, scope: 'all' } } as CatalogueEntry;
		await loadCatalogueLayer(whole, null, fetcher as never);

		expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('$where')).toBeNull();
	});

	it('loads the dataset from elsewhere when nothing is in the map view', async () => {
		const answers = [collection(0), collection(3)];
		const fetcher = vi.fn<(url: string) => Promise<Response>>(() => reply(answers.shift()));
		const result = await loadCatalogueLayer(socrata, [0, 0, 1, 1], fetcher as never);

		expect(result.geojson.features).toHaveLength(3);
		expect(result.outsideView).toBe(true);
		expect(new URL(fetcher.mock.calls[0][0]).searchParams.has('$where')).toBe(true);
		expect(new URL(fetcher.mock.calls[1][0]).searchParams.has('$where')).toBe(false);
	});

	it('loads the dataset whole when there is no map view', async () => {
		const fetcher = vi.fn<(url: string) => Promise<Response>>(() => reply(collection(2)));
		await loadCatalogueLayer(socrata, null, fetcher as never);

		expect(new URL(fetcher.mock.calls[0][0]).searchParams.has('$where')).toBe(false);
	});
});

describe('loadCatalogueLayer from OpenDataPhilly', () => {
	const jkan: CatalogueEntry = { ...viewport, provider: 'opendataphilly', source: { type: 'jkan', slug: 'political-wards' } };
	const md = `---
resources:
- description: ''
  format: API
  name: x
  url: https://services.example.com/arcgis/rest/services/W/FeatureServer/0/query?where=1%3D1
---`;

	it('looks up how to load the dataset, then loads it by map view', async () => {
		const fetcher = vi.fn((url: string) =>
			url.includes('raw.githubusercontent.com')
				? Promise.resolve({ ok: true, text: () => Promise.resolve(md), json: () => Promise.resolve({}) } as unknown as Response)
				: reply(collection(2))
		);
		const result = await loadCatalogueLayer(jkan, [-75.3, 39.8, -74.9, 40.1], fetcher as never);

		expect(result.geojson.features).toHaveLength(2);
		const loadUrl = new URL(fetcher.mock.calls[1][0]);
		expect(loadUrl.pathname).toBe('/arcgis/rest/services/W/FeatureServer/0/query');
		expect(loadUrl.searchParams.get('geometry')).toBe('-75.3,39.8,-74.9,40.1');
	});

	it('says so when the dataset has nothing that can be loaded', async () => {
		const fetcher = vi.fn(() =>
			Promise.resolve({ ok: true, text: () => Promise.resolve('---\nresources:\n---'), json: () => Promise.resolve({}) } as unknown as Response)
		);
		await expect(loadCatalogueLayer(jkan, [0, 0, 1, 1], fetcher as never)).rejects.toThrow(
			'no map layer that can be loaded here'
		);
	});
});

describe('loadCatalogueLayer from Carto', () => {
	const carto: CatalogueEntry = {
		...viewport,
		source: { type: 'carto', baseUrl: 'https://phl.carto.com', table: 'shootings' }
	};

	it('asks for the shapes inside the map view, as GeoJSON', async () => {
		const fetcher = vi.fn<(url: string) => Promise<Response>>(() => reply(collection(3)));
		const result = await loadCatalogueLayer(carto, [-75.3, 39.8, -74.9, 40.1], fetcher as never);

		const url = new URL(fetcher.mock.calls[0][0]);
		expect(url.origin + url.pathname).toBe('https://phl.carto.com/api/v2/sql');
		expect(url.searchParams.get('format')).toBe('GeoJSON');
		expect(url.searchParams.get('q')).toBe(
			`SELECT * FROM shootings WHERE the_geom && ST_MakeEnvelope(-75.3, 39.8, -74.9, 40.1, 4326) LIMIT ${MAX_FEATURES}`
		);
		expect(result.geojson.features).toHaveLength(3);
	});

	it('refuses a table name that is not a plain name', async () => {
		const bad = { ...carto, source: { type: 'carto', baseUrl: 'https://phl.carto.com', table: 'x; DROP TABLE y' } } as CatalogueEntry;
		const fetcher = vi.fn();
		await expect(loadCatalogueLayer(bad, [0, 0, 1, 1], fetcher as never)).rejects.toBeInstanceOf(CatalogueError);
		await expect(loadCatalogueLayer(bad, null, fetcher as never)).rejects.toBeInstanceOf(CatalogueError);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('loads the table from elsewhere when nothing is in the map view', async () => {
		const answers = [collection(0), collection(6)];
		const fetcher = vi.fn<(url: string) => Promise<Response>>(() => reply(answers.shift()));
		const result = await loadCatalogueLayer(carto, [0, 0, 1, 1], fetcher as never);

		expect(result.geojson.features).toHaveLength(6);
		expect(result.outsideView).toBe(true);
		expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('q')).toBe(
			`SELECT * FROM shootings LIMIT ${MAX_FEATURES}`
		);
	});

	it('loads the table whole when there is no map view', async () => {
		const fetcher = vi.fn<(url: string) => Promise<Response>>(() => reply(collection(2)));
		await loadCatalogueLayer(carto, null, fetcher as never);

		expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('q')).toBe(
			`SELECT * FROM shootings LIMIT ${MAX_FEATURES}`
		);
	});
});

describe('CENSUS_ENTRIES', () => {
	it('has unique ids, all loaded by map view over https', () => {
		const ids = CENSUS_ENTRIES.map((entry) => entry.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const entry of CENSUS_ENTRIES) {
			expect(entry.source).toMatchObject({ type: 'arcgis', scope: 'viewport' });
			expect((entry.source as { layerUrl: string }).layerUrl.startsWith('https://')).toBe(true);
		}
	});
});
