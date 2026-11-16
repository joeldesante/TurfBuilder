import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	parseResources,
	PHILLY_PAGE_SIZE,
	resetOpenDataPhillyCache,
	resolveOpenDataPhillySource,
	searchOpenDataPhilly,
	sourceFromResources
} from './opendataphilly';

const item = (over: Record<string, unknown> = {}) => ({
	title: 'Political Wards',
	organization: 'City of Philadelphia',
	notes: '<p>Boundaries of wards</p>',
	category: ['Boundaries'],
	resource_names: 'Political Wards (CSV) Political Wards (GeoJSON) Political Wards (API)',
	tags: 'Elections',
	url: '/datasets/political-wards/',
	...over
});

const reply = (body: unknown, ok = true) =>
	vi.fn<(url: string) => Promise<unknown>>(() =>
		Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body), text: () => Promise.resolve(String(body)) })
	);

beforeEach(() => resetOpenDataPhillyCache());
afterEach(() => resetOpenDataPhillyCache());

const PHILLY: [number, number, number, number] = [-75.3, 39.85, -74.95, 40.15];

describe('searchOpenDataPhilly', () => {
	it('lists datasets that offer a map file, as official entries', async () => {
		const fetcher = reply([item(), item({ title: 'A table', resource_names: 'A table (CSV)', url: '/datasets/a-table/' })]);
		const page = await searchOpenDataPhilly({ q: '', area: null }, 0, fetcher as never);

		expect(page.entries).toHaveLength(1);
		expect(page.entries[0]).toMatchObject({
			id: 'opendataphilly-political-wards',
			provider: 'opendataphilly',
			name: 'Political Wards',
			description: 'Boundaries of wards',
			publisher: 'City of Philadelphia',
			official: true,
			sourceUrl: 'https://opendataphilly.org/datasets/political-wards/',
			source: { type: 'jkan', slug: 'political-wards' }
		});
	});

	it('matches every word typed against title, description, tags and category', async () => {
		const fetcher = reply([item(), item({
				title: 'Parks',
				notes: 'Green',
				tags: 'Recreation',
				category: ['Environment'],
				resource_names: 'Parks (GeoJSON)',
				url: '/datasets/parks/'
			})]);

		expect((await searchOpenDataPhilly({ q: 'elections wards', area: null }, 0, fetcher as never)).entries).toHaveLength(1);
		expect((await searchOpenDataPhilly({ q: 'recreation', area: null }, 0, fetcher as never)).entries[0].name).toBe('Parks');
		expect((await searchOpenDataPhilly({ q: 'wards parks', area: null }, 0, fetcher as never)).entries).toHaveLength(0);
	});

	it('puts titles that start with the search first', async () => {
		const fetcher = reply([
			item({ title: 'Zoning near wards', url: '/datasets/z/' }),
			item({ title: 'Wards of the city', url: '/datasets/w/' })
		]);
		const page = await searchOpenDataPhilly({ q: 'wards', area: null }, 0, fetcher as never);

		expect(page.entries.map((e) => e.name)).toEqual(['Wards of the city', 'Zoning near wards']);
	});

	it('marks every dataset official, since the whole site is the city\'s own portal', async () => {
		const fetcher = reply([
			item({ url: '/datasets/a/', title: 'A', organization: 'City of Philadelphia' }),
			item({ url: '/datasets/b/', title: 'B', organization: 'Chester County GIS' }),
			item({ url: '/datasets/c/', title: 'C', organization: 'Monument Lab' })
		]);

		const all = await searchOpenDataPhilly({ q: '', area: null }, 0, fetcher as never);
		expect(all.entries.map((e) => e.official)).toEqual([true, true, true]);
		const official = await searchOpenDataPhilly({ q: '', area: null, officialOnly: true }, 0, fetcher as never);
		expect(official.entries).toHaveLength(3);
	});

	it('only answers for Philadelphia, and fetches the catalogue once', async () => {
		const fetcher = reply([item()]);

		expect((await searchOpenDataPhilly({ q: '', area: PHILLY }, 0, fetcher as never)).entries).toHaveLength(1);
		expect((await searchOpenDataPhilly({ q: '', area: [-87.8, 41.7, -87.5, 42.0] }, 0, fetcher as never)).entries).toEqual([]);
		await searchOpenDataPhilly({ q: 'x', area: null }, 0, fetcher as never);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('pages through a long list', async () => {
		const many = Array.from({ length: PHILLY_PAGE_SIZE + 5 }, (_, i) => item({ title: `Layer ${String(i).padStart(3, '0')}`, url: `/datasets/l${i}/` }));
		const fetcher = reply(many);

		const first = await searchOpenDataPhilly({ q: '', area: null }, 0, fetcher as never);
		expect(first).toMatchObject({ hasMore: true, next: PHILLY_PAGE_SIZE });
		const second = await searchOpenDataPhilly({ q: '', area: null }, PHILLY_PAGE_SIZE, fetcher as never);
		expect(second.entries).toHaveLength(5);
		expect(second.hasMore).toBe(false);
	});

	it('tries again after a failure instead of remembering it', async () => {
		await expect(searchOpenDataPhilly({ q: '', area: null }, 0, reply({}, false) as never)).rejects.toThrow();
		const page = await searchOpenDataPhilly({ q: '', area: null }, 0, reply([item()]) as never);
		expect(page.entries).toHaveLength(1);
	});
});

const WARDS = `---
organization: City of Philadelphia
resources:
- description: ''
  format: GeoJSON
  name: Political Wards (GeoJSON)
  url: https://hub.arcgis.com/api/v3/datasets/abc_0/downloads/data?format=geojson&spatialRefId=4326&where=1%3D1
- description: ''
  format: API
  name: Political Wards (API)
  url: https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/Political_Wards/FeatureServer/0/query?outFields=*&where=1%3D1
- description: ''
  format: HTML
  name: Political Wards (Metadata)
  url: https://metadata.phila.gov/#home/datasetdetails/5543866f/
schema: philadelphia
title: Political Wards
---
Body text`;

const CARTO = `---
resources:
- description: ''
  format: CSV
  name: 311 Requests for 2020 (CSV)
  url: https://phl.carto.com/api/v2/sql?filename=public_cases_fc&format=csv&skipfields=cartodb_id,the_geom&q=SELECT
    * FROM public_cases_fc WHERE requested_datetime >= '2020-01-01'
- description: ''
  format: GeoJSON
  name: Other
  url: https://phl.carto.com/api/v2/sql?format=geojson&q=SELECT%20*%20FROM%20shootings
tags:
- x
---`;

describe('parseResources', () => {
	it('reads each resource format and address', () => {
		const resources = parseResources(WARDS);

		expect(resources.map((r) => r.format)).toEqual(['GeoJSON', 'API', 'HTML']);
		expect(resources[1].url).toContain('/Political_Wards/FeatureServer/0/query');
	});

	it('joins an address that continues on indented lines', () => {
		expect(parseResources(CARTO)[0].url).toContain('SELECT * FROM public_cases_fc WHERE');
	});

	it('stops at the next top-level key and tolerates a file with no header', () => {
		expect(parseResources(WARDS)).toHaveLength(3);
		expect(parseResources('no header here')).toEqual([]);
	});
});

describe('sourceFromResources', () => {
	it('prefers the ArcGIS layer, loaded by map view', () => {
		expect(sourceFromResources(parseResources(WARDS))).toEqual({
			type: 'arcgis',
			layerUrl: 'https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/Political_Wards/FeatureServer/0',
			scope: 'viewport'
		});
	});

	it('falls back to a Carto table, found from the query', () => {
		expect(sourceFromResources(parseResources(CARTO))).toEqual({
			type: 'carto',
			baseUrl: 'https://phl.carto.com',
			table: 'public_cases_fc'
		});
	});

	it('is null when there is neither', () => {
		expect(sourceFromResources([{ format: 'CSV', url: 'https://example.org/a.csv' }])).toBeNull();
	});
});

describe('resolveOpenDataPhillySource', () => {
	it('reads the dataset source file and picks a way to load it', async () => {
		const fetcher = reply(WARDS);
		const source = await resolveOpenDataPhillySource('political-wards', fetcher as never);

		expect(fetcher.mock.calls[0][0]).toBe(
			'https://raw.githubusercontent.com/opendataphilly/opendataphilly-jkan/main/_datasets/political-wards.md'
		);
		expect(source.type).toBe('arcgis');
	});

	it('refuses a name that could change the address, and a dataset with nothing to load', async () => {
		const fetcher = reply(WARDS);
		await expect(resolveOpenDataPhillySource('../../evil', fetcher as never)).rejects.toThrow();
		expect(fetcher).not.toHaveBeenCalled();
		await expect(resolveOpenDataPhillySource('x', reply('---\nresources:\n---') as never)).rejects.toThrow();
		await expect(resolveOpenDataPhillySource('x', reply('', false) as never)).rejects.toThrow();
	});
});
