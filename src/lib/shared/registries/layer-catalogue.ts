import type { Bounds } from '$lib/shared/utils/geojson-bounds';
import type { GeometryKind } from '$lib/shared/utils/geojson-geometry';

/**
 * Where map layers come from. There is no list of datasets here to keep up to date: the
 * map editor searches these portals live each time. This file only names the portals, and
 * adding one is one line.
 */

/** The searches the map editor runs. */
export type CatalogueProvider = 'hub' | 'socrata' | 'ckan' | 'opendataphilly' | 'datagov' | 'census';

export const PROVIDER_NAMES: Record<CatalogueProvider, string> = {
	hub: 'ArcGIS Hub',
	socrata: 'City portals (Socrata)',
	ckan: 'City portals (CKAN)',
	opendataphilly: 'OpenDataPhilly',
	datagov: 'data.gov',
	census: 'US Census Bureau'
};

/** How a result is loaded onto the map. */
export type CatalogueSource =
	/** A GeoJSON file at a fixed address. */
	| { type: 'url'; url: string }
	/**
	 * An ArcGIS layer, read with the standard query API in pages. With `scope: 'viewport'`
	 * only the shapes in the map view are loaded, for layers too big to load whole.
	 */
	| { type: 'arcgis'; layerUrl: string; scope: 'all' | 'viewport' }
	/**
	 * An OpenDataPhilly dataset, named by its page. Its data links are looked up when it is loaded,
	 * and turn into an ArcGIS or Carto source.
	 */
	| { type: 'jkan'; slug: string }
	/** A table on a Carto account, read as GeoJSON, by map view. */
	| { type: 'carto'; baseUrl: string; table: string }
	/** A Socrata dataset, read as GeoJSON. `geoColumn` is the column that holds the shapes. */
	| { type: 'socrata'; domain: string; dataset: string; geoColumn: string; scope: 'all' | 'viewport' };

export interface CatalogueEntry {
	/** Unique across providers. */
	id: string;
	provider: CatalogueProvider;
	name: string;
	description: string;
	/** Who publishes it: an agency, city or organization. */
	publisher: string;
	/** True when it comes from a government's own data portal, not a third party that republished it. */
	official: boolean;
	/** What the layer is made of, when the portal says. */
	geometry: GeometryKind | null;
	/** How many shapes it holds, when the portal says. */
	count: number | null;
	/** The property to label shapes with, when the portal names an obvious one. */
	labelField: string | null;
	/** The dataset's own page at its source, to check the data there. */
	sourceUrl: string | null;
	source: CatalogueSource;
}

/** A page of search results. */
export interface CataloguePage {
	entries: CatalogueEntry[];
	/** Whether asking for the next page can return more. */
	hasMore: boolean;
}

/**
 * City portals on Socrata, with the area each covers, so a search near the map only asks the
 * portals that cover it. Socrata has no search by place of its own.
 */
export const SOCRATA_PORTALS: readonly { domain: string; name: string; bounds: Bounds }[] = [
	{ domain: 'data.cityofchicago.org', name: 'Chicago', bounds: [-88.0, 41.6, -87.5, 42.05] },
	{ domain: 'data.cityofnewyork.us', name: 'New York City', bounds: [-74.3, 40.45, -73.65, 40.95] },
	{ domain: 'data.sfgov.org', name: 'San Francisco', bounds: [-122.55, 37.68, -122.33, 37.84] },
	{ domain: 'data.lacity.org', name: 'Los Angeles', bounds: [-118.7, 33.7, -118.1, 34.4] },
	{ domain: 'data.seattle.gov', name: 'Seattle', bounds: [-122.45, 47.45, -122.2, 47.8] },
	{ domain: 'data.austintexas.gov', name: 'Austin', bounds: [-98.0, 30.1, -97.55, 30.55] },
	{ domain: 'www.dallasopendata.com', name: 'Dallas', bounds: [-97.1, 32.6, -96.5, 33.05] },
	{ domain: 'data.kcmo.org', name: 'Kansas City', bounds: [-94.75, 38.85, -94.35, 39.35] },
	{ domain: 'data.nola.gov', name: 'New Orleans', bounds: [-90.2, 29.85, -89.6, 30.1] }
];

/**
 * Governments that publish through ArcGIS Hub, by the id of their ArcGIS organization. Layers
 * from these are marked official, and "official only" searches only these. Find an id in the
 * `orgId` of any of the government's layers on hub.arcgis.com.
 */
export const OFFICIAL_HUB_ORGS: readonly { orgId: string; name: string }[] = [
	{ orgId: 'fLeGjb7u4uXqeF9q', name: 'City of Philadelphia' },
	{ orgId: 'neT9SoYxizqTHZPH', name: 'Washington, DC' },
	{ orgId: '8Pc9XBTAsYuxx9Ny', name: 'Miami-Dade County' },
	{ orgId: 'ZOyb2t4B0UYuYNYH', name: 'City of Seattle' },
	{ orgId: 'VTyQ9soqVukalItT', name: 'US Department of Housing and Urban Development' }
];

/**
 * Official city portals built on CKAN, an open source data portal. They do not allow browser
 * requests, so they are searched through the server, which only talks to the portals listed here.
 */
export const CKAN_PORTALS: readonly { id: string; name: string; baseUrl: string; bounds: Bounds }[] = [
	{ id: 'boston', name: 'City of Boston', baseUrl: 'https://data.boston.gov', bounds: [-71.3, 42.2, -70.9, 42.45] },
	{ id: 'toronto', name: 'City of Toronto', baseUrl: 'https://ckan0.cf.opendata.inter.prod-toronto.ca', bounds: [-79.7, 43.55, -79.1, 43.9] },
	{ id: 'pittsburgh', name: 'City of Pittsburgh (WPRDC)', baseUrl: 'https://data.wprdc.org', bounds: [-80.2, 40.35, -79.8, 40.55] }
];

/**
 * OpenDataPhilly, the City of Philadelphia's open data site. Everything on it is published through
 * the city's own portal, so all of it is official whoever the listed publisher is. It is a static site built from a
 * public repository, so its whole catalogue is one JSON file, and each dataset's page source
 * lists the links to its data (mostly ArcGIS layers, and Carto tables for the large ones).
 */
export const OPENDATAPHILLY = {
	siteUrl: 'https://opendataphilly.org',
	indexUrl: 'https://opendataphilly.org/datasets.json',
	/** Where each dataset's source file lives, as `<slug>.md`. */
	sourceBase: 'https://raw.githubusercontent.com/opendataphilly/opendataphilly-jkan/main/_datasets',
	cartoBase: 'https://phl.carto.com',
	bounds: [-75.45, 39.8, -74.85, 40.2] as Bounds
};

const TIGER = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb';

/**
 * Census boundaries. TIGERweb is a plain service directory with no search, so these few are
 * listed by hand. Each was checked against the live service.
 */
const CENSUS: readonly [id: string, name: string, description: string, layer: string][] = [
	['states', 'States', 'State boundaries.', 'State_County/MapServer/0'],
	['counties', 'Counties', 'County boundaries.', 'State_County/MapServer/1'],
	['congressional-districts', 'Congressional districts', 'The 119th Congress.', 'Legislative/MapServer/4'],
	['state-senate', 'State legislative districts (upper)', 'State Senate districts (2024).', 'Legislative/MapServer/5'],
	['state-house', 'State legislative districts (lower)', 'State House districts (2024).', 'Legislative/MapServer/6'],
	['places', 'Incorporated places', 'Cities, towns and villages.', 'Places_CouSub_ConCity_SubMCD/MapServer/11'],
	['tracts', 'Census tracts', 'Tens of thousands nationwide: zoom in first.', 'Tracts_Blocks/MapServer/4'],
	['block-groups', 'Census block groups', 'Zoom in first.', 'Tracts_Blocks/MapServer/5'],
	['zcta', 'ZIP Code Tabulation Areas', 'Census approximations of ZIP codes.', 'PUMA_TAD_TAZ_UGA_ZCTA/MapServer/4'],
	['pumas', 'Public Use Microdata Areas', 'PUMAs.', 'PUMA_TAD_TAZ_UGA_ZCTA/MapServer/3'],
	['voting-districts', 'Voting districts (2020)', 'Precinct-level districts from the 2020 census. Zoom in first.', 'Legislative/MapServer/15']
];

export const CENSUS_ENTRIES: readonly CatalogueEntry[] = CENSUS.map(([id, name, description, layer]) => ({
	id: `census-${id}`,
	provider: 'census',
	name,
	description,
	publisher: 'US Census Bureau',
	official: true,
	geometry: 'polygon',
	count: null,
	labelField: 'BASENAME',
	sourceUrl: `${TIGER}/${layer}`,
	source: { type: 'arcgis', layerUrl: `${TIGER}/${layer}`, scope: 'viewport' }
}));
