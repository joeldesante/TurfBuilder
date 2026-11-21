import type { Bounds } from '$lib/shared/utils/geojson-bounds';
import type { CatalogueEntry } from '$lib/shared/registries/layer-catalogue';
import { resolveOpenDataPhillySource } from '$lib/client/opendataphilly';

type FeatureCollection = { type: 'FeatureCollection'; features: unknown[] };

/** Shapes per request, kept under what these services allow in one reply. */
export const PAGE_SIZE = 1000;
/** The most shapes loaded for one layer, so a wide view of a dense dataset cannot freeze the map. */
export const MAX_FEATURES = 10000;

/** Thrown with a message that is safe to show a user. */
export class CatalogueError extends Error {}

export interface CatalogueResult {
	geojson: FeatureCollection;
	/** True when the layer has more shapes than were loaded. */
	truncated: boolean;
	/** True when nothing was in the map view, so the layer was loaded from wherever its shapes are. */
	outsideView: boolean;
}

/** The address of one page of an ArcGIS query, optionally limited to a box. */
export function arcgisQueryUrl(layerUrl: string, offset: number, bounds: Bounds | null): string {
	const params = new URLSearchParams({
		where: '1=1',
		outFields: '*',
		outSR: '4326',
		// Five decimals is about a metre: plenty for a map, and far smaller to send.
		geometryPrecision: '5',
		resultOffset: String(offset),
		resultRecordCount: String(PAGE_SIZE),
		f: 'geojson'
	});
	if (bounds) {
		params.set('geometry', bounds.join(','));
		params.set('geometryType', 'esriGeometryEnvelope');
		params.set('inSR', '4326');
		params.set('spatialRel', 'esriSpatialRelIntersects');
	}
	return `${layerUrl}/query?${params}`;
}

async function getJson(url: string, fetcher: typeof fetch): Promise<unknown> {
	let response: Response;
	try {
		response = await fetcher(url);
	} catch {
		throw new CatalogueError('The data could not be reached. Check your connection and try again.');
	}
	if (!response.ok) {
		throw new CatalogueError('The data source did not return the layer. Try again later.');
	}
	try {
		return await response.json();
	} catch {
		throw new CatalogueError('The data source sent something that is not GeoJSON.');
	}
}

function asCollection(value: unknown): FeatureCollection {
	const collection = value as { type?: unknown; features?: unknown; error?: unknown } | null;
	if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
		throw new CatalogueError('The data source did not return any shapes.');
	}
	return collection as FeatureCollection;
}

/** The shapes of a source, limited to `bounds` (west, south, east, north) when given. */
async function readShapes(
	source: Exclude<CatalogueEntry['source'], { type: 'jkan' }>,
	bounds: Bounds | null,
	fetcher: typeof fetch
): Promise<{ features: unknown[]; truncated: boolean }> {
	if (source.type === 'url') {
		return { features: asCollection(await getJson(source.url, fetcher)).features, truncated: false };
	}

	if (source.type === 'carto') {
		if (!/^[a-z_][a-z0-9_]*$/i.test(source.table)) {
			throw new CatalogueError('The data source did not return the layer. Try again later.');
		}
		// Carto tables keep their shapes in `the_geom`.
		const where = bounds
			? ` WHERE the_geom && ST_MakeEnvelope(${bounds[0]}, ${bounds[1]}, ${bounds[2]}, ${bounds[3]}, 4326)`
			: '';
		const query = `SELECT * FROM ${source.table}${where} LIMIT ${MAX_FEATURES}`;
		const url = `${source.baseUrl}/api/v2/sql?format=GeoJSON&q=${encodeURIComponent(query)}`;
		const { features } = asCollection(await getJson(url, fetcher));
		return { features, truncated: features.length >= MAX_FEATURES };
	}

	if (source.type === 'socrata') {
		const params = new URLSearchParams({ $limit: String(MAX_FEATURES) });
		if (bounds) {
			params.set('$where', `within_box(${source.geoColumn}, ${bounds[3]}, ${bounds[0]}, ${bounds[1]}, ${bounds[2]})`);
		}
		const url = `https://${source.domain}/resource/${source.dataset}.geojson?${params}`;
		const { features } = asCollection(await getJson(url, fetcher));
		return { features, truncated: features.length >= MAX_FEATURES };
	}

	const features: unknown[] = [];
	let truncated = false;
	for (let offset = 0; ; offset += PAGE_SIZE) {
		const page = asCollection(await getJson(arcgisQueryUrl(source.layerUrl, offset, bounds), fetcher));
		features.push(...page.features);
		if (page.features.length < PAGE_SIZE) break;
		if (features.length >= MAX_FEATURES) {
			truncated = true;
			break;
		}
	}
	return { features, truncated };
}

/**
 * Loads a catalogue entry as GeoJSON. A layer too big to load whole is asked for by map view
 * (`viewBounds`: west, south, east, north) so what is near the map comes first. When nothing is in
 * the view, or there is no view, the layer is loaded from wherever its shapes are instead of
 * failing; `outsideView` says that happened.
 */
export async function loadCatalogueLayer(
	entry: CatalogueEntry,
	viewBounds: Bounds | null,
	fetcher: typeof fetch = fetch
): Promise<CatalogueResult> {
	const { source } = entry;

	if (source.type === 'jkan') {
		// OpenDataPhilly names a dataset by its page; its data links say how to load it.
		let resolved;
		try {
			resolved = await resolveOpenDataPhillySource(source.slug, fetcher);
		} catch {
			throw new CatalogueError(
				'This OpenDataPhilly dataset has no map layer that can be loaded here. Open its page to download it.'
			);
		}
		return loadCatalogueLayer({ ...entry, source: resolved }, viewBounds, fetcher);
	}

	const byView = source.type === 'carto' || (source.type !== 'url' && source.scope === 'viewport');
	let outsideView = false;
	let shapes = await readShapes(source, byView ? viewBounds : null, fetcher);
	if (byView && viewBounds && shapes.features.length === 0) {
		outsideView = true;
		shapes = await readShapes(source, null, fetcher);
	}

	if (shapes.features.length === 0) throw new CatalogueError('This layer has no shapes.');
	return {
		geojson: { type: 'FeatureCollection', features: shapes.features },
		truncated: shapes.truncated,
		outsideView
	};
}
