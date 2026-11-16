import { error } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { CKAN_PORTALS, type CatalogueEntry } from '$lib/shared/registries/layer-catalogue';
import type { CkanSearchResult, DataGovSearchResult } from '$lib/shared/types/layer-catalogue';
import type { GeometryKind } from '$lib/shared/utils/geojson-geometry';
import { plainText } from '$lib/shared/utils/plain-text';

/** data.gov's search. It sends no CORS headers, so the browser cannot call it and this does. */
const DATA_GOV_SEARCH = 'https://catalog.data.gov/search';
/** Datasets asked for per page. Most have no loadable layer, so many are dropped. */
const PAGE_SIZE = 40;

interface Distribution {
	format?: string | null;
	mediaType?: string | null;
	accessURL?: string | null;
	downloadURL?: string | null;
}

/** data.gov's kinds of publisher that are a government. The others (universities, non-profits) are not. */
export const GOVERNMENT_ORG_TYPES = [
	'Federal Government',
	'State Government',
	'County Government',
	'City Government',
	'Tribal'
] as const;

interface DataGovDataset {
	identifier?: string;
	slug?: string;
	title?: string;
	description?: string;
	publisher?: string;
	organization?: { organization_type?: string };
	dcat?: { distribution?: Distribution[] };
}

const ARCGIS_LAYER = /\/rest\/services\/.+\/(FeatureServer|MapServer)\/\d+\/?$/i;

function isHttps(value: string | null | undefined): value is string {
	return typeof value === 'string' && value.startsWith('https://');
}

/**
 * The address the map can load a dataset from, or null when it has none. An ArcGIS layer is
 * best (it can be queried by map view and in pages); a plain GeoJSON file is next. Hub
 * download links are skipped: they build the file on request and answer later.
 */
export function loadableSource(distributions: Distribution[]): CatalogueEntry['source'] | null {
	for (const distribution of distributions) {
		const url = distribution.accessURL ?? distribution.downloadURL;
		if (isHttps(url) && ARCGIS_LAYER.test(url.split('?')[0])) {
			return { type: 'arcgis', layerUrl: url.split('?')[0].replace(/\/$/, ''), scope: 'viewport' };
		}
	}
	for (const distribution of distributions) {
		const url = distribution.downloadURL ?? distribution.accessURL;
		const geojson =
			distribution.format?.toLowerCase() === 'geojson' ||
			distribution.mediaType === 'application/vnd.geo+json' ||
			distribution.mediaType === 'application/geo+json';
		if (geojson && isHttps(url) && !url.includes('/api/download/v1/')) {
			return { type: 'url', url };
		}
	}
	return null;
}

function toEntry(dataset: DataGovDataset): CatalogueEntry | null {
	const source = loadableSource(dataset.dcat?.distribution ?? []);
	const id = dataset.identifier ?? dataset.slug;
	if (!source || !id || !dataset.title) return null;
	return {
		id: `datagov-${id}`,
		provider: 'datagov',
		name: dataset.title,
		description: plainText(dataset.description),
		publisher: dataset.publisher ?? 'data.gov',
		official: (GOVERNMENT_ORG_TYPES as readonly string[]).includes(
			dataset.organization?.organization_type ?? ''
		),
		geometry: null as GeometryKind | null,
		count: null,
		labelField: null,
		sourceUrl: dataset.slug ? `https://catalog.data.gov/dataset/${encodeURIComponent(dataset.slug)}` : null,
		source
	};
}

/**
 * One page of data.gov datasets matching `q` that can be loaded as a map layer. data.gov
 * pages by a cursor: pass back `next` from the last page as `after`.
 */
export async function searchDataGov(
	query: string,
	after?: string,
	officialOnly = false
): Promise<DataGovSearchResult> {
	const params = new URLSearchParams({
		q: query,
		per_page: String(PAGE_SIZE),
		spatial_filter: 'geospatial',
		sort: query ? 'relevance' : 'popularity'
	});
	if (after) params.set('after', after);
	if (officialOnly) for (const type of GOVERNMENT_ORG_TYPES) params.append('org_type', type);

	let body: { results?: DataGovDataset[]; after?: string | null };
	try {
		const response = await fetch(`${DATA_GOV_SEARCH}?${params}`, {
			signal: AbortSignal.timeout(10_000),
			headers: { accept: 'application/json' }
		});
		if (!response.ok) throw new Error(`data.gov answered ${response.status}`);
		body = await response.json();
	} catch (err) {
		logger.warn({ err }, 'data.gov search failed; the map editor shows no data.gov results');
		throw error(502, 'data.gov could not be reached. Try again shortly.');
	}

	const results = Array.isArray(body.results) ? body.results : [];
	const entries = results.map(toEntry).filter((entry): entry is CatalogueEntry => entry !== null);
	const next = results.length === PAGE_SIZE && body.after ? body.after : null;
	return { entries, hasMore: next !== null, next };
}

interface CkanPackage {
	id?: string;
	name?: string;
	title?: string;
	notes?: string;
	resources?: { format?: string | null; url?: string | null }[];
}

/** Datasets asked for per page of a CKAN portal. */
const CKAN_PAGE_SIZE = 20;

/**
 * One page of a city's own CKAN portal, limited to datasets with a GeoJSON file or an ArcGIS
 * layer. Only portals named in the registry are asked: the caller picks one by id and never
 * supplies an address, so this cannot be pointed at another server.
 */
export async function searchCkanPortal(
	portalId: string,
	query: string,
	start: number
): Promise<CkanSearchResult> {
	const portal = CKAN_PORTALS.find((candidate) => candidate.id === portalId);
	if (!portal) throw error(404, 'That data portal is not available.');

	const params = new URLSearchParams({
		q: query,
		rows: String(CKAN_PAGE_SIZE),
		start: String(start),
		fq: 'res_format:("GeoJSON" OR "ArcGIS GeoServices REST API" OR "Esri REST")'
	});

	let body: { result?: { count?: number; results?: CkanPackage[] } };
	try {
		const response = await fetch(`${portal.baseUrl}/api/3/action/package_search?${params}`, {
			signal: AbortSignal.timeout(10_000),
			headers: { accept: 'application/json' }
		});
		if (!response.ok) throw new Error(`${portal.id} answered ${response.status}`);
		body = await response.json();
	} catch (err) {
		logger.warn({ err, portal: portal.id }, 'CKAN portal search failed; the map editor shows no results from it');
		throw error(502, `${portal.name} could not be reached. Try again shortly.`);
	}

	const packages = Array.isArray(body.result?.results) ? body.result.results : [];
	const entries: CatalogueEntry[] = [];
	for (const pkg of packages) {
		const source = loadableSource(
			(pkg.resources ?? []).map((resource) => ({ format: resource.format, accessURL: resource.url }))
		);
		if (!source || !pkg.id || !pkg.title) continue;
		entries.push({
			id: `ckan-${portal.id}-${pkg.id}`,
			provider: 'ckan',
			name: pkg.title,
			description: plainText(pkg.notes),
			publisher: portal.name,
			official: true,
			geometry: null,
			count: null,
			labelField: null,
			sourceUrl: pkg.name ? `${portal.baseUrl}/dataset/${encodeURIComponent(pkg.name)}` : null,
			source
		});
	}

	const total = body.result?.count ?? 0;
	const hasMore = start + CKAN_PAGE_SIZE < total;
	return { entries, hasMore, next: hasMore ? start + CKAN_PAGE_SIZE : null };
}
