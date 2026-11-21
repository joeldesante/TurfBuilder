import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('$lib/server/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { loadableSource, searchCkanPortal, searchDataGov } from './layer-catalogue.service';

afterEach(() => vi.unstubAllGlobals());

const arcgis = {
	format: 'ArcGIS GeoServices REST API',
	accessURL: 'https://gis.example.org/arcgis/rest/services/Data/Boundaries/MapServer/5'
};
const geojson = { format: 'GeoJSON', mediaType: 'application/vnd.geo+json', downloadURL: 'https://data.example.org/wards.geojson' };
const hubDownload = {
	format: 'GeoJSON',
	downloadURL: 'https://hub.example.org/api/download/v1/items/abc/geojson?layers=0'
};

describe('loadableSource', () => {
	it('prefers an ArcGIS layer, loaded by map view', () => {
		expect(loadableSource([geojson, arcgis])).toEqual({
			type: 'arcgis',
			layerUrl: arcgis.accessURL,
			scope: 'viewport'
		});
	});

	it('falls back to a plain GeoJSON file', () => {
		expect(loadableSource([geojson])).toEqual({ type: 'url', url: geojson.downloadURL });
	});

	it('skips Hub downloads, a whole service without a layer, and non-https addresses', () => {
		expect(loadableSource([hubDownload])).toBeNull();
		expect(
			loadableSource([{ accessURL: 'https://gis.example.org/arcgis/rest/services/Data/MapServer' }])
		).toBeNull();
		expect(loadableSource([{ ...arcgis, accessURL: 'http://gis.example.org/rest/services/X/MapServer/1' }])).toBeNull();
	});
});

describe('searchDataGov', () => {
	const reply = (body: unknown, ok = true) =>
		vi.fn<(url: string) => Promise<unknown>>(() =>
			Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) })
		);

	it('keeps only datasets that can be loaded, as catalogue entries', async () => {
		const fetcher = reply({
			results: [
				{ identifier: 'a', slug: 'council-districts', title: 'Council Districts', publisher: 'City X', dcat: { distribution: [arcgis] } },
				{ identifier: 'b', title: 'A spreadsheet', dcat: { distribution: [{ format: 'CSV' }] } }
			],
			after: 'cursor'
		});
		vi.stubGlobal('fetch', fetcher);

		const page = await searchDataGov('council');

		expect(page.entries).toHaveLength(1);
		expect(page.entries[0]).toMatchObject({
			id: 'datagov-a',
			provider: 'datagov',
			publisher: 'City X',
			sourceUrl: 'https://catalog.data.gov/dataset/council-districts'
		});
		expect(page.hasMore).toBe(false);
		const url = new URL(fetcher.mock.calls[0][0] as string);
		expect(url.searchParams.get('q')).toBe('council');
		expect(url.searchParams.get('spatial_filter')).toBe('geospatial');
	});

	it('marks datasets from a government publisher as official, and others not', async () => {
		vi.stubGlobal(
			'fetch',
			reply({
				results: [
					{ identifier: 'a', title: 'A', organization: { organization_type: 'City Government' }, dcat: { distribution: [arcgis] } },
					{ identifier: 'b', title: 'B', organization: { organization_type: 'Federal Government' }, dcat: { distribution: [arcgis] } },
					{ identifier: 'c', title: 'C', organization: { organization_type: 'University' }, dcat: { distribution: [arcgis] } },
					{ identifier: 'd', title: 'D', dcat: { distribution: [arcgis] } }
				]
			})
		);

		const page = await searchDataGov('x');

		expect(page.entries.map((entry) => entry.official)).toEqual([true, true, false, false]);
	});

	it('asks data.gov for government publishers only when official only', async () => {
		const fetcher = reply({ results: [] });
		vi.stubGlobal('fetch', fetcher);

		await searchDataGov('x', undefined, true);

		const types = new URL(fetcher.mock.calls[0][0]).searchParams.getAll('org_type');
		expect(types).toContain('City Government');
		expect(types).toContain('Federal Government');
		expect(types).not.toContain('University');
	});

	it('hands back a cursor when the page was full', async () => {
		const results = Array.from({ length: 40 }, (_, i) => ({ identifier: `d${i}`, title: `T${i}`, dcat: { distribution: [] } }));
		vi.stubGlobal('fetch', reply({ results, after: 'next-cursor' }));

		const page = await searchDataGov('x');

		expect(page).toMatchObject({ hasMore: true, next: 'next-cursor' });
	});

	it('browses by popularity with no search text, and passes the cursor on', async () => {
		const fetcher = reply({ results: [] });
		vi.stubGlobal('fetch', fetcher);

		await searchDataGov('', 'abc');

		const url = new URL(fetcher.mock.calls[0][0] as string);
		expect(url.searchParams.get('sort')).toBe('popularity');
		expect(url.searchParams.get('after')).toBe('abc');
	});

	it('answers 502 when data.gov fails', async () => {
		vi.stubGlobal('fetch', reply({}, false));
		await expect(searchDataGov('x')).rejects.toMatchObject({ status: 502 });

		vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))));
		await expect(searchDataGov('x')).rejects.toMatchObject({ status: 502 });
	});
});

describe('searchCkanPortal', () => {
	const reply = (body: unknown, ok = true) =>
		vi.fn<(url: string) => Promise<unknown>>(() =>
			Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) })
		);

	const pkg = (id: string, resources: { format: string; url: string }[]) => ({
		id,
		name: `slug-${id}`,
		title: `Dataset ${id}`,
		notes: '<p>About <b>it</b></p>',
		resources
	});

	it('turns loadable datasets into official entries and skips the rest', async () => {
		const fetcher = reply({
			result: {
				count: 2,
				results: [
					pkg('a', [{ format: 'GeoJSON', url: 'https://data.boston.gov/wards.geojson' }]),
					pkg('b', [{ format: 'CSV', url: 'https://data.boston.gov/table.csv' }])
				]
			}
		});
		vi.stubGlobal('fetch', fetcher);

		const page = await searchCkanPortal('boston', 'wards', 0);

		expect(page.entries).toHaveLength(1);
		expect(page.entries[0]).toMatchObject({
			id: 'ckan-boston-a',
			provider: 'ckan',
			publisher: 'City of Boston',
			official: true,
			description: 'About it',
			sourceUrl: 'https://data.boston.gov/dataset/slug-a',
			source: { type: 'url', url: 'https://data.boston.gov/wards.geojson' }
		});
		expect(page.hasMore).toBe(false);
		const url = new URL(fetcher.mock.calls[0][0]);
		expect(url.origin).toBe('https://data.boston.gov');
		expect(url.searchParams.get('q')).toBe('wards');
	});

	it('offers the next page while there are more datasets', async () => {
		vi.stubGlobal('fetch', reply({ result: { count: 45, results: [] } }));

		expect(await searchCkanPortal('toronto', '', 20)).toMatchObject({ hasMore: true, next: 40 });
	});

	it('only talks to portals in the registry', async () => {
		const fetcher = reply({});
		vi.stubGlobal('fetch', fetcher);

		await expect(searchCkanPortal('https://evil.example', '', 0)).rejects.toMatchObject({ status: 404 });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('answers 502 when the portal fails', async () => {
		vi.stubGlobal('fetch', reply({}, false));
		await expect(searchCkanPortal('boston', '', 0)).rejects.toMatchObject({ status: 502 });
	});
});
