/**
 * Custom map styles that match the app's Tailwind zinc + emerald palette.
 * Fetches the OpenFreeMap positron base style and applies theme color overrides.
 */

const POSITRON_URL = 'https://tiles.openfreemap.org/styles/positron';

// Cache the base style so we only fetch it once
let cachedBaseStyle: Record<string, unknown> | null = null;

async function fetchBaseStyle(): Promise<Record<string, unknown>> {
	if (!cachedBaseStyle) {
		const res = await fetch(POSITRON_URL);
		cachedBaseStyle = (await res.json()) as Record<string, unknown>;
	}
	return cachedBaseStyle;
}

// Light theme — clean zinc palette with emerald/blue accents
const lightColors = {
	background: '#fafafa', // zinc-50
	park: '#ecfdf5', // emerald-50
	water: '#dbeafe', // blue-100
	ice: '#f4f4f5', // zinc-100
	residential: '#f4f4f5', // zinc-100
	wood: '#d1fae5', // emerald-100
	waterway: '#93c5fd', // blue-300
	building_fill: '#e4e4e7', // zinc-200
	building_outline: '#d4d4d8', // zinc-300
	road_pier: '#e4e4e7', // zinc-200
	road_minor: '#e4e4e7', // zinc-200
	road_major_inner: '#ffffff',
	road_major_casing: '#d4d4d8', // zinc-300
	road_motorway_inner: '#ffffff',
	road_motorway_casing: '#a1a1aa', // zinc-400
	road_subtle: '#e4e4e7', // zinc-200
	aeroway: '#e4e4e7', // zinc-200
	railway: '#d4d4d8', // zinc-300
	boundary: '#a1a1aa', // zinc-400
	text: '#18181b', // zinc-900
	text_water: '#3b82f6', // blue-500
	text_halo: 'rgba(250,250,250,0.8)'
};

// Dark theme — zinc-900 base with emerald-950 parks and blue-950 water
const darkColors = {
	background: '#18181b', // zinc-900
	park: '#022c22', // emerald-950
	water: '#172554', // blue-950
	ice: '#3f3f46', // zinc-700
	residential: '#27272a', // zinc-800
	wood: '#052e16', // emerald-950 (darker green)
	waterway: '#1e3a8a', // blue-900
	building_fill: '#27272a', // zinc-800
	building_outline: '#3f3f46', // zinc-700
	road_pier: '#3f3f46', // zinc-700
	road_minor: '#3f3f46', // zinc-700
	road_major_inner: '#52525b', // zinc-600
	road_major_casing: '#3f3f46', // zinc-700
	road_motorway_inner: '#71717a', // zinc-500
	road_motorway_casing: '#52525b', // zinc-600
	road_subtle: '#52525b', // zinc-600
	aeroway: '#27272a', // zinc-800
	railway: '#3f3f46', // zinc-700
	boundary: '#52525b', // zinc-600
	text: '#f4f4f5', // zinc-100
	text_water: '#93c5fd', // blue-300
	text_halo: 'rgba(24,24,27,0.8)'
};

type Colors = typeof lightColors;

function applyThemeToLayer(
	id: string,
	paint: Record<string, unknown>,
	c: Colors
): Record<string, unknown> {
	const p = { ...paint };

	switch (id) {
		case 'background':
			p['background-color'] = c.background;
			break;
		case 'park':
			p['fill-color'] = c.park;
			break;
		case 'water':
			p['fill-color'] = c.water;
			break;
		case 'landcover_ice_shelf':
		case 'landcover_glacier':
			p['fill-color'] = c.ice;
			break;
		case 'landuse_residential':
			p['fill-color'] = c.residential;
			break;
		case 'landcover_wood':
			p['fill-color'] = c.wood;
			break;
		case 'waterway':
			p['line-color'] = c.waterway;
			break;
		case 'building':
			p['fill-color'] = c.building_fill;
			p['fill-outline-color'] = c.building_outline;
			break;
		case 'tunnel_motorway_casing':
		case 'highway_motorway_casing':
		case 'highway_motorway_bridge_casing':
			p['line-color'] = c.road_motorway_casing;
			break;
		case 'tunnel_motorway_inner':
		case 'highway_motorway_inner':
		case 'highway_motorway_bridge_inner':
			p['line-color'] = c.road_motorway_inner;
			break;
		case 'highway_motorway_subtle':
			p['line-color'] = c.road_subtle;
			break;
		case 'aeroway-taxiway':
		case 'aeroway-runway-casing':
		case 'aeroway-runway':
			p['line-color'] = c.aeroway;
			break;
		case 'aeroway-area':
			p['fill-color'] = c.aeroway;
			break;
		case 'road_area_pier':
			p['fill-color'] = c.road_pier;
			break;
		case 'road_pier':
			p['line-color'] = c.road_pier;
			break;
		case 'highway_path':
		case 'highway_minor':
		case 'highway_major_subtle':
			p['line-color'] = c.road_minor;
			break;
		case 'highway_major_casing':
			p['line-color'] = c.road_major_casing;
			break;
		case 'highway_major_inner':
			p['line-color'] = c.road_major_inner;
			break;
		case 'railway_transit':
		case 'railway_transit_dashline':
		case 'railway_service':
		case 'railway_service_dashline':
		case 'railway':
		case 'railway_dashline':
			p['line-color'] = c.railway;
			break;
		case 'boundary_3':
		case 'boundary_2':
		case 'boundary_disputed':
			p['line-color'] = c.boundary;
			break;
		case 'waterway_line_label':
		case 'water_name_point_label':
		case 'water_name_line_label':
			p['text-color'] = c.text_water;
			p['text-halo-color'] = c.text_halo;
			break;
		case 'highway-name-path':
		case 'highway-name-minor':
		case 'highway-name-major':
		case 'highway-shield-non-us':
		case 'highway-shield-us-interstate':
		case 'road_shield_us':
		case 'airport':
		case 'label_other':
		case 'label_village':
		case 'label_town':
		case 'label_state':
		case 'label_city':
		case 'label_city_capital':
		case 'label_country_3':
		case 'label_country_2':
		case 'label_country_1':
			p['text-color'] = c.text;
			p['text-halo-color'] = c.text_halo;
			break;
	}

	return p;
}

export async function getMapStyle(isDark: boolean): Promise<Record<string, unknown>> {
	const base = await fetchBaseStyle();
	const colors = isDark ? darkColors : lightColors;

	const layers = (base.layers as Array<Record<string, unknown>>).map((layer) => {
		const paint = applyThemeToLayer(
			layer.id as string,
			(layer.paint as Record<string, unknown>) ?? {},
			colors
		);
		return { ...layer, paint };
	});

	return { ...base, layers };
}
