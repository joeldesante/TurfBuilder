import { OPENDATAPHILLY, type CatalogueEntry, type CatalogueSource } from '$lib/shared/registries/layer-catalogue';
import type { Bounds } from '$lib/shared/utils/geojson-bounds';
import { plainText } from '$lib/shared/utils/plain-text';

/** One dataset in OpenDataPhilly's catalogue (datasets.json). */
interface IndexItem {
	title?: string;
	organization?: string;
	notes?: string;
	category?: string[];
	resource_names?: string;
	tags?: string;
	url?: string;
}

/** Datasets per page. */
export const PHILLY_PAGE_SIZE = 25;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Only datasets that offer a map file (GeoJSON, shapefile or KML) are shapes; the rest are tables. */
const SPATIAL = /\((geojson|shp|kml)\)/i;

let indexCache: Promise<IndexItem[]> | null = null;

/** The whole catalogue, fetched once per page load. */
function loadIndex(fetcher: typeof fetch): Promise<IndexItem[]> {
	indexCache ??= fetcher(OPENDATAPHILLY.indexUrl)
		.then((response) => {
			if (!response.ok) throw new Error(`OpenDataPhilly answered ${response.status}`);
			return response.json();
		})
		.then((body) => (Array.isArray(body) ? (body as IndexItem[]) : []))
		.catch((error) => {
			// A failed load must not stick: the next search tries again.
			indexCache = null;
			throw error;
		});
	return indexCache;
}

/** Forgets the fetched catalogue. For tests. */
export function resetOpenDataPhillyCache() {
	indexCache = null;
}

function toEntry(item: IndexItem): CatalogueEntry | null {
	const slug = /^\/datasets\/([^/]+)\/?$/.exec(text(item.url))?.[1];
	if (!slug || !text(item.title)) return null;
	return {
		id: `opendataphilly-${slug}`,
		provider: 'opendataphilly',
		name: text(item.title),
		description: plainText(text(item.notes)),
		publisher: text(item.organization) || 'OpenDataPhilly',
		// The whole site is the city's own portal, whoever the publisher is.
		official: true,
		geometry: null,
		count: null,
		labelField: null,
		sourceUrl: `${OPENDATAPHILLY.siteUrl}/datasets/${slug}/`,
		source: { type: 'jkan', slug }
	};
}

/**
 * Searches OpenDataPhilly's own catalogue. Words typed must all appear in a dataset's title,
 * description, tags, category or file names; titles that start with the first word come first.
 */
export async function searchOpenDataPhilly(
	{ q, area, officialOnly }: { q: string; area: Bounds | null; officialOnly?: boolean },
	offset: number,
	fetcher: typeof fetch = fetch
): Promise<{ entries: CatalogueEntry[]; hasMore: boolean; next: number | null }> {
	const none = { entries: [], hasMore: false, next: null };
	const b = OPENDATAPHILLY.bounds;
	// The site only covers Philadelphia.
	if (area && !(b[0] <= area[2] && b[2] >= area[0] && b[1] <= area[3] && b[3] >= area[1])) return none;

	const words = q.toLowerCase().split(/\s+/).filter(Boolean);
	const scored: { entry: CatalogueEntry; rank: number }[] = [];
	for (const item of await loadIndex(fetcher)) {
		if (!SPATIAL.test(text(item.resource_names))) continue;
		const entry = toEntry(item);
		if (!entry || (officialOnly && !entry.official)) continue;

		const title = entry.name.toLowerCase();
		const haystack = [title, text(item.notes), text(item.tags), (item.category ?? []).join(' '), text(item.resource_names)]
			.join(' ')
			.toLowerCase();
		if (!words.every((word) => haystack.includes(word))) continue;

		const rank = words.length === 0 ? 2 : title.startsWith(words[0]) ? 0 : words.every((w) => title.includes(w)) ? 1 : 2;
		scored.push({ entry, rank });
	}
	scored.sort((a, b2) => a.rank - b2.rank || a.entry.name.localeCompare(b2.entry.name));

	const page = scored.slice(offset, offset + PHILLY_PAGE_SIZE).map((s) => s.entry);
	const hasMore = offset + PHILLY_PAGE_SIZE < scored.length;
	return { entries: page, hasMore, next: hasMore ? offset + PHILLY_PAGE_SIZE : null };
}

interface Resource {
	format: string;
	url: string;
}

/**
 * The data links in a dataset's source file. The file starts with a YAML header that lists
 * `resources:`, each with a `format` and a `url`; a long url can continue on indented lines.
 */
export function parseResources(source: string): Resource[] {
	const header = /^---\s*\n([\s\S]*?)\n---/.exec(source)?.[1] ?? '';
	const resources: Resource[] = [];
	let inResources = false;
	let current: { format: string; url: string } | null = null;
	let continuing = false;

	for (const line of header.split('\n')) {
		if (/^resources:\s*$/.test(line)) {
			inResources = true;
			continue;
		}
		if (!inResources) continue;
		if (/^\S/.test(line) && !line.startsWith('-')) break; // the next top-level key

		const start = /^- description:/.test(line);
		if (start) {
			if (current) resources.push(current);
			current = { format: '', url: '' };
			continuing = false;
			continue;
		}
		if (!current) continue;
		const format = /^\s+format:\s*(.*)$/.exec(line);
		const url = /^\s+url:\s*(.*)$/.exec(line);
		if (format) {
			current.format = format[1].trim().replace(/^['"]|['"]$/g, '');
			continuing = false;
		} else if (url) {
			current.url = url[1].trim().replace(/^['"]|['"]$/g, '');
			continuing = true;
		} else if (continuing && /^\s{4,}\S/.test(line)) {
			current.url += ` ${line.trim()}`;
		} else {
			continuing = false;
		}
	}
	if (current) resources.push(current);
	return resources;
}

const ARCGIS_LAYER = /^(https:\/\/.+\/rest\/services\/.+\/(?:FeatureServer|MapServer)\/\d+)(?:\/query.*)?$/i;
const CARTO_TABLE = /^https:\/\/phl\.carto\.com\/api\/v2\/sql\?.*?\bfrom(?:%20|\+|\s)+([a-z_][a-z0-9_]*)/i;

/**
 * The way to load a dataset, from its links: an ArcGIS layer first (it can be read by map
 * view and in pages), then a Carto table. Null when it offers neither.
 */
export function sourceFromResources(resources: Resource[]): CatalogueSource | null {
	for (const resource of resources) {
		const layer = ARCGIS_LAYER.exec(resource.url);
		if (layer) return { type: 'arcgis', layerUrl: layer[1], scope: 'viewport' };
	}
	for (const resource of resources) {
		const table = CARTO_TABLE.exec(resource.url);
		if (table) return { type: 'carto', baseUrl: OPENDATAPHILLY.cartoBase, table: table[1] };
	}
	return null;
}

/** Looks up how to load a dataset: reads its source file and picks a way. Throws when there is none. */
export async function resolveOpenDataPhillySource(
	slug: string,
	fetcher: typeof fetch = fetch
): Promise<CatalogueSource> {
	if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) throw new Error('Not a dataset name');
	const response = await fetcher(`${OPENDATAPHILLY.sourceBase}/${slug}.md`);
	if (!response.ok) throw new Error(`Dataset source answered ${response.status}`);
	const source = sourceFromResources(parseResources(await response.text()));
	if (!source) throw new Error('No loadable link');
	return source;
}
