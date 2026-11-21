import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from '@vitest/browser/context';
import LayerCatalogue from './LayerCatalogue.svelte';
import { CITIES } from '$lib/shared/registries/cities';

/** Answers each provider's search from a stub, so no test reaches the network. */
function stubSearch(opts: { hub?: unknown[]; hubFails?: boolean; datagov?: unknown[]; philly?: unknown[] } = {}) {
	const calls: string[] = [];
	vi.stubGlobal('fetch', (input: string) => {
		const url = String(input);
		calls.push(url);
		const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)), json: () => Promise.resolve(body) });
		if (url.includes('opendataphilly.org/datasets.json')) return ok(opts.philly ?? []);
		if (url.includes('hub.arcgis.com')) {
			return opts.hubFails
				? Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })
				: ok({ data: opts.hub ?? [], meta: { page: { nextStart: 99 }, total: 10 } });
		}
		if (url.includes('api.us.socrata.com')) return ok({ results: [], resultSetSize: 0 });
		if (url.includes('/layer-catalogue/ckan')) return ok({ entries: [], hasMore: false, next: null });
		if (url.includes('/layer-catalogue/data-gov')) {
			return ok({ entries: opts.datagov ?? [], hasMore: false, next: null });
		}
		return Promise.reject(new Error(`unexpected ${url}`));
	});
	return calls;
}

const hubItem = (id: string, name: string, over: Record<string, unknown> = {}) => ({
	id,
	attributes: {
		name,
		snippet: `About ${name}`,
		source: 'City of Philadelphia',
		geometryType: 'esriGeometryPolygon',
		recordCount: 66,
		fields: [],
		url: `https://services.example.com/arcgis/rest/services/${id}/FeatureServer/0`,
		...over
	}
});

const area = () => [-75.3, 39.85, -74.95, 40.15] as [number, number, number, number];

afterEach(() => vi.unstubAllGlobals());

describe('LayerCatalogue', () => {
	it('lists the built-in Census boundaries before anything is typed', async () => {
		stubSearch();
		render(LayerCatalogue, { props: { onPick: vi.fn(), getViewBounds: area } });

		await expect.element(page.getByRole('listitem', { name: /Congressional districts/ })).toBeVisible();
		await expect.element(page.getByText('Type to search').or(page.getByRole('listitem').first())).toBeVisible();
	});

	it('searches everywhere by default, then near the map when asked', async () => {
		const calls = stubSearch({ hub: [hubItem('wards', 'Political Wards')] });
		render(LayerCatalogue, { props: { onPick: vi.fn(), getViewBounds: area } });

		await userEvent.fill(page.getByRole('searchbox', { name: 'Search layers' }), 'wards');
		await expect.element(page.getByRole('listitem', { name: /Political Wards/ })).toBeVisible();
		const hubCalls = () => calls.filter((url) => url.includes('hub.arcgis.com'));
		expect(hubCalls().at(-1)).not.toContain('bbox=');

		await page.getByRole('button', { name: 'Area' }).click();
		await page.getByRole('option', { name: 'Near the map' }).click();
		await vi.waitFor(() => expect(hubCalls().at(-1)).toContain('bbox='));
	});

	it('limits the search to the chosen city', async () => {
		const calls = stubSearch({ hub: [hubItem('wards', 'Political Wards')] });
		render(LayerCatalogue, { props: { onPick: vi.fn(), getViewBounds: area } });
		await userEvent.fill(page.getByRole('searchbox', { name: 'Search layers' }), 'wards');

		await page.getByRole('button', { name: 'City' }).click();
		await page.getByRole('option', { name: 'Philadelphia, PA' }).click();

		await vi.waitFor(() => {
			const last = calls.filter((url) => url.includes('hub.arcgis.com')).at(-1)!;
			expect(decodeURIComponent(new URL(last).searchParams.get('bbox')!)).toBe(
				CITIES.find((c) => c.id === 'philadelphia-pa')!.bounds.join(',')
			);
		});
		await expect.element(page.getByRole('button', { name: 'Area' })).toBeDisabled();
	});

	it('goes back to every city when Any city is chosen', async () => {
		const calls = stubSearch({ hub: [hubItem('wards', 'Political Wards')] });
		render(LayerCatalogue, { props: { onPick: vi.fn(), getViewBounds: area } });
		await userEvent.fill(page.getByRole('searchbox', { name: 'Search layers' }), 'wards');
		await page.getByRole('button', { name: 'City' }).click();
		await page.getByRole('option', { name: 'Chicago, IL' }).click();
		await page.getByRole('button', { name: 'City' }).click();
		await page.getByRole('option', { name: 'Any city' }).click();

		await vi.waitFor(() =>
			expect(calls.filter((url) => url.includes('hub.arcgis.com')).at(-1)).not.toContain('bbox=')
		);
		await expect.element(page.getByRole('button', { name: 'Area' })).toBeEnabled();
	});

	it('shows each result with its publisher, size and layer type', async () => {
		stubSearch({ hub: [hubItem('wards', 'Political Wards')] });
		render(LayerCatalogue, { props: { onPick: vi.fn(), getViewBounds: area } });

		await userEvent.fill(page.getByRole('searchbox', { name: 'Search layers' }), 'wards');

		const row = page.getByRole('listitem', { name: /Political Wards/ });
		await expect.element(row).toHaveTextContent('City of Philadelphia');
		await expect.element(row).toHaveTextContent('66 shapes');
		await expect.element(row).toHaveTextContent('Polygons');
	});

	it('links each result to its dataset page at the source', async () => {
		stubSearch({ hub: [hubItem('wards', 'Political Wards')] });
		render(LayerCatalogue, { props: { onPick: vi.fn(), getViewBounds: area } });

		await userEvent.fill(page.getByRole('searchbox', { name: 'Search layers' }), 'wards');
		await expect.element(page.getByRole('listitem', { name: /Political Wards/ })).toBeVisible();

		const links = page.getByRole('link', { name: /ArcGIS Hub/ });
		await expect.element(links.first()).toHaveAttribute('href', 'https://hub.arcgis.com/datasets/wards');
		await expect.element(links.first()).toHaveAttribute('target', '_blank');
	});

	it('limits results to official portals when asked, and marks them', async () => {
		const calls = stubSearch({
			hub: [
				hubItem('wards', 'Political Wards', { orgId: 'fLeGjb7u4uXqeF9q' }),
				hubItem('fan', 'Fan Wards', { orgId: 'someoneElse', source: 'A fan' })
			]
		});
		render(LayerCatalogue, { props: { onPick: vi.fn(), getViewBounds: area } });
		await userEvent.fill(page.getByRole('searchbox', { name: 'Search layers' }), 'wards');
		await expect.element(page.getByRole('listitem', { name: /Fan Wards/ })).toBeVisible();
		await expect.element(page.getByText('Official').first()).toBeVisible();

		await page.getByRole('button', { name: 'Publisher type' }).click();
		await page.getByRole('option', { name: 'Official portals only' }).click();

		await expect.element(page.getByRole('listitem', { name: /Fan Wards/ })).not.toBeInTheDocument();
		await expect.element(page.getByRole('listitem', { name: /Political Wards/ })).toBeVisible();
		await vi.waitFor(() =>
			expect(calls.filter((url) => url.includes('hub.arcgis.com')).at(-1)).toContain('filter%5BorgId%5D')
		);
	});

	it('lists OpenDataPhilly datasets, marked official', async () => {
		stubSearch({
			philly: [
				{
					title: 'Political Wards',
					organization: 'City of Philadelphia',
					notes: 'Boundaries',
					category: ['Boundaries'],
					resource_names: 'Political Wards (GeoJSON) Political Wards (API)',
					tags: '',
					url: '/datasets/political-wards/'
				}
			]
		});
		render(LayerCatalogue, { props: { onPick: vi.fn(), getViewBounds: area } });
		await userEvent.fill(page.getByRole('searchbox', { name: 'Search layers' }), 'wards');

		const row = page.getByRole('listitem', { name: /Political Wards/ });
		await expect.element(row).toBeVisible();
		await expect.element(page.getByRole('link', { name: /OpenDataPhilly/ })).toHaveAttribute(
			'href',
			'https://opendataphilly.org/datasets/political-wards/'
		);
		await expect.element(page.getByText('Official').first()).toBeVisible();
	});

	it('narrows results by layer type', async () => {
		stubSearch({
			hub: [
				hubItem('wards', 'Political Wards'),
				hubItem('stops', 'Transit Stops', { geometryType: 'esriGeometryPoint' })
			]
		});
		render(LayerCatalogue, { props: { onPick: vi.fn(), getViewBounds: area } });
		await userEvent.fill(page.getByRole('searchbox', { name: 'Search layers' }), 'x');
		await expect.element(page.getByRole('listitem', { name: /Transit Stops/ })).toBeVisible();

		await page.getByRole('button', { name: 'Layer type' }).click();
		await page.getByRole('option', { name: 'Points' }).click();

		await expect.element(page.getByRole('listitem', { name: /Political Wards/ })).not.toBeInTheDocument();
		await expect.element(page.getByRole('listitem', { name: /Transit Stops/ })).toBeVisible();
	});

	it('narrows results by publisher', async () => {
		stubSearch({
			hub: [
				hubItem('a', 'Wards A'),
				hubItem('b', 'Wards B', { source: 'City of Chicago' })
			]
		});
		render(LayerCatalogue, { props: { onPick: vi.fn(), getViewBounds: area } });
		await userEvent.fill(page.getByRole('searchbox', { name: 'Search layers' }), 'wards');
		await expect.element(page.getByRole('listitem', { name: /Wards B/ })).toBeVisible();

		await page.getByRole('button', { name: 'Publisher' }).click();
		await page.getByRole('option', { name: /City of Chicago/ }).click();

		await expect.element(page.getByRole('listitem', { name: /Wards A/ })).not.toBeInTheDocument();
	});

	it('includes data.gov results, loaded through the server', async () => {
		const calls = stubSearch({
			datagov: [
				{
					id: 'datagov-1',
					provider: 'datagov',
					name: 'Federal Lands',
					description: '',
					publisher: 'Interior',
					official: false,
					geometry: null,
					count: null,
					labelField: null,
					sourceUrl: null,
					source: { type: 'arcgis', layerUrl: 'https://gis.example.gov/arcgis/rest/services/A/MapServer/1', scope: 'viewport' }
				}
			]
		});
		render(LayerCatalogue, { props: { onPick: vi.fn(), getViewBounds: area } });

		await expect.element(page.getByRole('listitem', { name: /Federal Lands/ })).toBeVisible();
		expect(calls.some((url) => url.includes('/api/v1/layer-catalogue/data-gov'))).toBe(true);
	});

	it('keeps the other sources when one cannot be searched', async () => {
		stubSearch({ hubFails: true });
		render(LayerCatalogue, { props: { onPick: vi.fn(), getViewBounds: area } });
		await userEvent.fill(page.getByRole('searchbox', { name: 'Search layers' }), 'wards');

		await expect.element(page.getByRole('alert')).toHaveTextContent('ArcGIS Hub could not be searched');
		await expect.element(page.getByRole('listitem', { name: /Congressional districts/ }).or(page.getByText('No layers found'))).toBeVisible();
	});

	it('reports the layer that was picked', async () => {
		stubSearch();
		const onPick = vi.fn();
		render(LayerCatalogue, { props: { onPick, getViewBounds: area } });

		await page.getByRole('listitem', { name: /Counties/ }).click();

		expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'census-counties' }));
	});

	it('cannot pick another layer while one loads', async () => {
		stubSearch();
		render(LayerCatalogue, { props: { onPick: vi.fn(), loadingId: 'census-states', getViewBounds: area } });

		await expect.element(page.getByRole('listitem', { name: /Counties/ })).toBeDisabled();
	});
});
