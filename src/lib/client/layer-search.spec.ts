import { describe, expect, it, vi } from 'vitest';
import { portalsNear, searchCensus, searchCkanPage, searchDataGovPage, searchHub, searchSocrata } from './layer-search';
import { OFFICIAL_HUB_ORGS } from '$lib/shared/registries/layer-catalogue';

const reply = (body: unknown, ok = true) =>
	vi.fn<(url: string) => Promise<unknown>>(() =>
		Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) })
	);

const PHILLY: [number, number, number, number] = [-75.3, 39.85, -74.95, 40.15];

const hubItem = (over: Record<string, unknown> = {}) => ({
	id: 'abc_0',
	attributes: {
		name: 'Political Wards',
		snippet: 'Boundaries of <b>wards</b>',
		source: 'City of Philadelphia',
		geometryType: 'esriGeometryPolygon',
		recordCount: 66,
		displayField: 'ward_num',
		orgId: 'fLeGjb7u4uXqeF9q',
		fields: [{ name: 'objectid' }, { name: 'ward_num' }],
		url: 'https://services.example.com/arcgis/rest/services/Political_Wards/FeatureServer/0',
		...over
	}
});

describe('searchHub', () => {
	it('asks for a search before showing anything', async () => {
		const fetcher = reply({});
		const page = await searchHub({ q: '  ', area: PHILLY }, 1, fetcher as never);

		expect(page.entries).toEqual([]);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('searches by the map view and turns layers into entries', async () => {
		const fetcher = reply({ data: [hubItem()], meta: { page: { nextStart: 26 }, total: 90 } });
		const page = await searchHub({ q: 'wards', area: PHILLY }, 1, fetcher as never);

		const url = new URL(fetcher.mock.calls[0][0]);
		expect(url.searchParams.get('q')).toBe('wards');
		expect(url.searchParams.get('bbox')).toBe(PHILLY.join(','));
		expect(page.entries[0]).toMatchObject({
			id: 'hub-abc_0',
			provider: 'hub',
			name: 'Political Wards',
			description: 'Boundaries of wards',
			publisher: 'City of Philadelphia',
			official: true,
			geometry: 'polygon',
			count: 66,
			labelField: 'ward_num',
			sourceUrl: 'https://hub.arcgis.com/datasets/abc_0',
			source: {
				type: 'arcgis',
				layerUrl: 'https://services.example.com/arcgis/rest/services/Political_Wards/FeatureServer/0',
				scope: 'all'
			}
		});
		expect(page).toMatchObject({ hasMore: true, next: 2 });
	});

	it('searches everywhere when there is no map area', async () => {
		const fetcher = reply({ data: [] });
		await searchHub({ q: 'wards', area: null }, 1, fetcher as never);

		expect(new URL(fetcher.mock.calls[0][0]).searchParams.has('bbox')).toBe(false);
	});

	it('loads big layers by map view and drops tables and non-layer addresses', async () => {
		const fetcher = reply({
			data: [
				hubItem({ recordCount: 500000 }),
				hubItem({ geometryType: undefined }),
				hubItem({ url: 'https://services.example.com/arcgis/rest/services/X/FeatureServer' })
			],
			meta: { page: { nextStart: 4 }, total: 3 }
		});
		const page = await searchHub({ q: 'x', area: null }, 1, fetcher as never);

		expect(page.entries).toHaveLength(1);
		expect(page.entries[0].source).toMatchObject({ scope: 'viewport' });
		expect(page.hasMore).toBe(false);
	});

	it('does not label with a field the layer lacks', async () => {
		const fetcher = reply({ data: [hubItem({ displayField: 'gone' })], meta: {} });
		const page = await searchHub({ q: 'x', area: null }, 1, fetcher as never);

		expect(page.entries[0].labelField).toBeNull();
	});

	it('marks only layers from a registered government as official', async () => {
		const fetcher = reply({
			data: [hubItem(), hubItem({ orgId: 'someoneElse', name: 'Fan map' })],
			meta: {}
		});
		const page = await searchHub({ q: 'x', area: null }, 1, fetcher as never);

		expect(page.entries.map((e) => e.official)).toEqual([true, false]);
	});

	it('limits an official-only search to the registered governments', async () => {
		const fetcher = reply({ data: [], meta: {} });
		await searchHub({ q: 'x', area: null, officialOnly: true }, 1, fetcher as never);

		const orgs = new URL(fetcher.mock.calls[0][0]).searchParams.get('filter[orgId]');
		expect(orgs?.split(',')).toEqual(OFFICIAL_HUB_ORGS.map((org) => org.orgId));
	});

	it('does not filter by organization for an ordinary search', async () => {
		const fetcher = reply({ data: [], meta: {} });
		await searchHub({ q: 'x', area: null }, 1, fetcher as never);

		expect(new URL(fetcher.mock.calls[0][0]).searchParams.has('filter[orgId]')).toBe(false);
	});

	it('fails when the portal does', async () => {
		await expect(searchHub({ q: 'x', area: null }, 1, reply({}, false) as never)).rejects.toThrow();
	});
});

describe('portalsNear', () => {
	it('picks the portals that cover the map view', () => {
		expect(portalsNear([-87.8, 41.7, -87.5, 42.0])?.map((p) => p.name)).toEqual(['Chicago']);
		expect(portalsNear(PHILLY)).toEqual([]);
		expect(portalsNear(null)).toBeNull();
	});
});

describe('searchSocrata', () => {
	const result = (types: string[], names: string[], domain = 'data.cityofchicago.org') => ({
		resource: { id: 'ward-1234', name: 'Wards', description: 'City wards', columns_datatype: types, columns_field_name: names },
		metadata: { domain }
	});

	it('keeps datasets with a shape column and notes which column', async () => {
		const fetcher = reply({
			results: [
				result(['Text', 'Multi Polygon'], ['name', 'the_geom']),
				result(['Text', 'Number'], ['name', 'n'])
			],
			resultSetSize: 2
		});
		const page = await searchSocrata({ q: 'ward', area: [-87.8, 41.7, -87.5, 42.0] }, 0, fetcher as never);

		expect(page.entries).toHaveLength(1);
		expect(page.entries[0]).toMatchObject({
			provider: 'socrata',
			publisher: 'Chicago',
			geometry: 'polygon',
			sourceUrl: 'https://data.cityofchicago.org/d/ward-1234',
			source: { type: 'socrata', domain: 'data.cityofchicago.org', geoColumn: 'the_geom' }
		});
		const url = new URL(fetcher.mock.calls[0][0]);
		expect(url.searchParams.get('domains')).toBe('data.cityofchicago.org');
		expect(url.searchParams.get('q')).toBe('ward');
	});

	it('searches no portal when none covers the map view', async () => {
		const fetcher = reply({});
		const page = await searchSocrata({ q: 'ward', area: PHILLY }, 0, fetcher as never);

		expect(page.entries).toEqual([]);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('searches every portal when searching everywhere, and browses by popularity', async () => {
		const fetcher = reply({ results: [], resultSetSize: 500 });
		const page = await searchSocrata({ q: '', area: null }, 0, fetcher as never);

		const url = new URL(fetcher.mock.calls[0][0]);
		expect(url.searchParams.has('domains')).toBe(false);
		expect(url.searchParams.get('order')).toBe('page_views_total');
		expect(page).toMatchObject({ hasMore: true, next: 100 });
	});
});

describe('searchSocrata official marking', () => {
	it('marks a listed city portal as official and an unlisted one as not', async () => {
		const row = (domain: string) => ({
			resource: { id: 'abcd-1234', name: 'N', description: '', columns_datatype: ['Polygon'], columns_field_name: ['g'] },
			metadata: { domain }
		});
		const fetcher = reply({ results: [row('data.cityofchicago.org'), row('data.example.org')], resultSetSize: 2 });
		const page = await searchSocrata({ q: 'x', area: null }, 0, fetcher as never);

		expect(page.entries.map((e) => e.official)).toEqual([true, false]);
	});

	it('searches only the listed portals when official only', async () => {
		const fetcher = reply({ results: [], resultSetSize: 0 });
		await searchSocrata({ q: 'x', area: null, officialOnly: true }, 0, fetcher as never);

		const domains = new URL(fetcher.mock.calls[0][0]).searchParams.get('domains');
		expect(domains).toContain('data.cityofchicago.org');
	});
});

describe('searchDataGovPage', () => {
	const answer = { entries: [], hasMore: false, next: null };
	const stubServer = () => {
		const urls: string[] = [];
		vi.stubGlobal('fetch', (input: string) => {
			urls.push(String(input));
			return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(answer)) });
		});
		return urls;
	};

	it('asks the server for government publishers only when official only', async () => {
		const urls = stubServer();
		await searchDataGovPage({ q: 'x', area: null, officialOnly: true }, null);
		vi.unstubAllGlobals();

		expect(urls[0]).toContain('official=1');
	});

	it('does not limit the publishers for an ordinary search', async () => {
		const urls = stubServer();
		await searchDataGovPage({ q: 'x', area: null }, null);
		vi.unstubAllGlobals();

		expect(urls[0]).not.toContain('official');
	});
});

describe('searchCkanPage', () => {
	const ckan = (portal: string) => ({
		entries: [{ id: `ckan-${portal}-1`, official: true }],
		hasMore: false,
		next: null
	});

	it('asks each portal near the area, through the server', async () => {
		const urls: string[] = [];
		vi.stubGlobal('fetch', (input: string) => {
			urls.push(String(input));
			const portal = new URL(String(input), 'https://example.test').searchParams.get('portal')!;
			return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(ckan(portal))) });
		});

		const page = await searchCkanPage({ q: 'wards', area: [-71.2, 42.3, -71.0, 42.4] }, 0);
		vi.unstubAllGlobals();

		expect(urls).toHaveLength(1);
		expect(urls[0]).toContain('/api/v1/layer-catalogue/ckan?');
		expect(urls[0]).toContain('portal=boston');
		expect(page.entries).toHaveLength(1);
	});

	it('asks every portal when searching everywhere', async () => {
		const urls: string[] = [];
		vi.stubGlobal('fetch', (input: string) => {
			urls.push(String(input));
			return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(ckan('x'))) });
		});

		await searchCkanPage({ q: '', area: null }, 0);
		vi.unstubAllGlobals();

		expect(urls).toHaveLength(3);
	});

	it('searches nothing when no portal covers the area', async () => {
		vi.stubGlobal('fetch', vi.fn());
		const page = await searchCkanPage({ q: 'x', area: [-75.3, 39.85, -74.95, 40.15] }, 0);
		vi.unstubAllGlobals();

		expect(page.entries).toEqual([]);
	});

	it('keeps the other portals when one fails, and fails only when all do', async () => {
		let call = 0;
		vi.stubGlobal('fetch', () => {
			call++;
			return call === 1
				? Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({ message: 'down' }) })
				: Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(ckan('x'))) });
		});
		const page = await searchCkanPage({ q: '', area: null }, 0);
		expect(page.entries).toHaveLength(2);

		vi.stubGlobal('fetch', () => Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({}) }));
		await expect(searchCkanPage({ q: '', area: null }, 0)).rejects.toThrow();
		vi.unstubAllGlobals();
	});
});

describe('searchCensus', () => {
	it('filters the built-in list by what was typed', () => {
		expect(searchCensus({ q: '', area: null }).entries.length).toBeGreaterThan(5);
		const found = searchCensus({ q: 'congressional', area: null }).entries;
		expect(found.map((e) => e.name)).toEqual(['Congressional districts']);
	});
});
