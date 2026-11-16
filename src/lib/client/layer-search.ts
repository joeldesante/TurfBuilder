import { api } from '$lib/client/api';
import { searchOpenDataPhilly } from '$lib/client/opendataphilly';
import {
	CENSUS_ENTRIES,
	CKAN_PORTALS,
	OFFICIAL_HUB_ORGS,
	SOCRATA_PORTALS,
	type CatalogueEntry,
	type CatalogueProvider,
	type CataloguePage
} from '$lib/shared/registries/layer-catalogue';
import type { CkanSearchResult, DataGovSearchResult } from '$lib/shared/types/layer-catalogue';
import type { Bounds } from '$lib/shared/utils/geojson-bounds';
import type { GeometryKind } from '$lib/shared/utils/geojson-geometry';

/** Results asked for per provider per page. */
export const SEARCH_PAGE_SIZE = 25;
/** Layers with at most this many shapes are loaded whole; bigger ones by map view. */
export const WHOLE_LAYER_LIMIT = 2000;

/** Where a search looks: near the map, or everywhere. */
export interface SearchParams {
	q: string;
	/** The map view (west, south, east, north); null searches everywhere. */
	area: Bounds | null;
	/** Only layers from a government's own data portal. */
	officialOnly?: boolean;
}

/** Where a provider left off, so the next page continues from there. */
export type Cursor = number | string | null;

export interface ProviderPage extends CataloguePage {
	next: Cursor;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** A JSON reply whose shape is checked field by field where it is read. */
type Json = { [key: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
const clip = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);

async function getJson(url: string, fetcher: typeof fetch): Promise<Json> {
	const response = await fetcher(url);
	if (!response.ok) throw new Error(`Search failed with ${response.status}`);
	return response.json();
}

const ESRI_GEOMETRY: Record<string, GeometryKind> = {
	esriGeometryPolygon: 'polygon',
	esriGeometryEnvelope: 'polygon',
	esriGeometryPolyline: 'line',
	esriGeometryPoint: 'point',
	esriGeometryMultipoint: 'point'
};
const ARCGIS_LAYER = /\/rest\/services\/.+\/(FeatureServer|MapServer)\/\d+\/?$/i;

/** ArcGIS Hub: every city and agency that publishes through ArcGIS, searched at once and by map view. */
export async function searchHub(
	{ q, area, officialOnly }: SearchParams,
	page: number,
	fetcher: typeof fetch = fetch
): Promise<ProviderPage> {
	// With nothing typed the whole of ArcGIS ranks by chance, so ask for a search first.
	if (!q.trim()) return { entries: [], hasMore: false, next: null };

	const params = new URLSearchParams({
		q,
		'page[size]': String(SEARCH_PAGE_SIZE),
		'page[number]': String(page)
	});
	if (area) params.set('bbox', area.join(','));
	if (officialOnly) params.set('filter[orgId]', OFFICIAL_HUB_ORGS.map((org) => org.orgId).join(','));
	const body = await getJson(`https://hub.arcgis.com/api/v3/datasets?${params}`, fetcher);

	const entries: CatalogueEntry[] = [];
	for (const item of Array.isArray(body.data) ? body.data : []) {
		const a = item?.attributes ?? {};
		const geometry = ESRI_GEOMETRY[a.geometryType];
		const url = text(a.url).split('?')[0];
		if (!geometry || !ARCGIS_LAYER.test(url)) continue;
		const count = typeof a.recordCount === 'number' ? a.recordCount : null;
		const fields: string[] = Array.isArray(a.fields) ? a.fields.map((f: { name?: string }) => text(f?.name)) : [];
		entries.push({
			id: `hub-${text(item.id)}`,
			provider: 'hub',
			name: text(a.name) || 'Untitled layer',
			description: clip(text(a.snippet) || text(a.searchDescription)),
			publisher: text(a.source) || text(a.orgName) || text(a.owner) || 'ArcGIS Hub',
			official: OFFICIAL_HUB_ORGS.some((org) => org.orgId === text(a.orgId)),
			geometry,
			count,
			labelField: fields.includes(text(a.displayField)) ? text(a.displayField) : null,
			sourceUrl: `https://hub.arcgis.com/datasets/${encodeURIComponent(text(item.id))}`,
			source: {
				type: 'arcgis',
				layerUrl: url.replace(/\/$/, ''),
				scope: count !== null && count <= WHOLE_LAYER_LIMIT ? 'all' : 'viewport'
			}
		});
	}

	const next = body?.meta?.page?.nextStart;
	const total = body?.meta?.total;
	const hasMore = typeof next === 'number' && typeof total === 'number' && next <= total;
	return { entries, hasMore, next: hasMore ? page + 1 : null };
}

const SOCRATA_GEOMETRY: Record<string, GeometryKind> = {
	Point: 'point',
	'Multi Point': 'point',
	Location: 'point',
	Line: 'line',
	'Multi Line': 'line',
	Polygon: 'polygon',
	'Multi Polygon': 'polygon',
	MultiPolygon: 'polygon'
};

/** The portals whose area meets `area`. All of them (null) when searching everywhere. */
function portalsMeeting<T extends { bounds: Bounds }>(portals: readonly T[], area: Bounds | null): T[] | null {
	if (!area) return null;
	return portals.filter(
		(p) => p.bounds[0] <= area[2] && p.bounds[2] >= area[0] && p.bounds[1] <= area[3] && p.bounds[3] >= area[1]
	);
}

/** The Socrata city portals whose area meets the map view. All of them when searching everywhere. */
export const portalsNear = (area: Bounds | null) => portalsMeeting(SOCRATA_PORTALS, area);

/** Socrata city portals, searched through its catalogue. Only datasets with a shape column are kept. */
export async function searchSocrata(
	{ q, area, officialOnly }: SearchParams,
	offset: number,
	fetcher: typeof fetch = fetch
): Promise<ProviderPage> {
	// Every Socrata portal in the registry is a government's own, and an unlisted one may not be.
	const near = portalsNear(area) ?? (officialOnly ? [...SOCRATA_PORTALS] : null);
	if (near && near.length === 0) return { entries: [], hasMore: false, next: null };

	const pageSize = 100;
	const params = new URLSearchParams({ only: 'datasets', limit: String(pageSize), offset: String(offset) });
	if (q.trim()) params.set('q', q.trim());
	else params.set('order', 'page_views_total');
	if (near) params.set('domains', near.map((p) => p.domain).join(','));
	const body = await getJson(`https://api.us.socrata.com/api/catalog/v1?${params}`, fetcher);

	const entries: CatalogueEntry[] = [];
	for (const result of Array.isArray(body.results) ? body.results : []) {
		const resource = result?.resource ?? {};
		const types: string[] = resource.columns_datatype ?? [];
		const names: string[] = resource.columns_field_name ?? [];
		const index = types.findIndex((type) => type in SOCRATA_GEOMETRY);
		const domain = text(result?.metadata?.domain);
		if (index < 0 || !domain || !resource.id) continue;
		const portal = SOCRATA_PORTALS.find((p) => p.domain === domain);
		entries.push({
			id: `socrata-${domain}-${text(resource.id)}`,
			provider: 'socrata',
			name: text(resource.name) || 'Untitled dataset',
			description: clip(text(resource.description)),
			publisher: portal?.name ?? domain,
			official: portal !== undefined,
			geometry: SOCRATA_GEOMETRY[types[index]],
			count: null,
			labelField: null,
			sourceUrl: `https://${domain}/d/${encodeURIComponent(text(resource.id))}`,
			source: {
				type: 'socrata',
				domain,
				dataset: text(resource.id),
				geoColumn: names[index],
				scope: 'viewport'
			}
		});
	}

	const total = typeof body.resultSetSize === 'number' ? body.resultSetSize : 0;
	const hasMore = offset + pageSize < total;
	return { entries, hasMore, next: hasMore ? offset + pageSize : null };
}

/** data.gov, searched through the server because it does not allow browser requests. */
export async function searchDataGovPage(
	{ q, officialOnly }: SearchParams,
	after: string | null
): Promise<ProviderPage> {
	const params = new URLSearchParams();
	if (officialOnly) params.set('official', '1');
	if (q.trim()) params.set('q', q.trim());
	if (after) params.set('after', after);
	const result = await api<DataGovSearchResult>(`/layer-catalogue/data-gov?${params}`);
	return { entries: result.entries, hasMore: result.hasMore, next: result.next };
}

/**
 * Official city CKAN portals, searched through the server. Each portal near the area is asked
 * for the same page and the results are joined.
 */
export async function searchCkanPage({ q, area }: SearchParams, start: number): Promise<ProviderPage> {
	const portals = portalsMeeting(CKAN_PORTALS, area) ?? CKAN_PORTALS;
	if (portals.length === 0) return { entries: [], hasMore: false, next: null };

	const settled = await Promise.allSettled(
		portals.map((portal) => {
			const params = new URLSearchParams({ portal: portal.id, start: String(start) });
			if (q.trim()) params.set('q', q.trim());
			return api<CkanSearchResult>(`/layer-catalogue/ckan?${params}`);
		})
	);
	const pages = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
	// Report a failure only when every portal failed, so one portal being down hides nothing else.
	if (pages.length === 0) throw new Error('No CKAN portal could be searched');

	const more = pages.find((page) => page.next !== null);
	return {
		entries: pages.flatMap((page) => page.entries),
		hasMore: more !== undefined,
		next: more?.next ?? null
	};
}

/** Census boundaries, listed by hand and filtered by what was typed. */
export function searchCensus({ q }: SearchParams): ProviderPage {
	const words = q.toLowerCase().split(/\s+/).filter(Boolean);
	const entries = CENSUS_ENTRIES.filter((entry) => {
		const haystack = `${entry.name} ${entry.description} census`.toLowerCase();
		return words.every((word) => haystack.includes(word));
	});
	return { entries: [...entries], hasMore: false, next: null };
}

export const PROVIDERS: CatalogueProvider[] = ['opendataphilly', 'hub', 'socrata', 'ckan', 'datagov', 'census'];

/** One page from one provider. `cursor` is where that provider's last page ended (null for the first). */
export function searchProvider(
	provider: CatalogueProvider,
	params: SearchParams,
	cursor: Cursor,
	fetcher: typeof fetch = fetch
): Promise<ProviderPage> {
	switch (provider) {
		case 'hub':
			return searchHub(params, typeof cursor === 'number' ? cursor : 1, fetcher);
		case 'socrata':
			return searchSocrata(params, typeof cursor === 'number' ? cursor : 0, fetcher);
		case 'opendataphilly':
			return searchOpenDataPhilly(params, typeof cursor === 'number' ? cursor : 0, fetcher);
		case 'ckan':
			return searchCkanPage(params, typeof cursor === 'number' ? cursor : 0);
		case 'datagov':
			return searchDataGovPage(params, typeof cursor === 'string' ? cursor : null);
		case 'census':
			return Promise.resolve(searchCensus(params));
	}
}
