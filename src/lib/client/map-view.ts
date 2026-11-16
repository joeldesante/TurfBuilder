import type {
	FilterSpecification,
	LayerSpecification,
	SourceSpecification
} from 'maplibre-gl';
import type { LayerGeoJSON } from '$lib/shared/types/map-layers';

/**
 * Pure builders for MapView: the GeoJSON it hands MapLibre and the style layers
 * it draws with. Kept out of the component so they can be tested without a map.
 */

export type MarkerVariant = 'unvisited' | 'contacted' | 'no-contact' | 'hostile';

/** A point MapView can draw. */
export interface MapPoint {
	id: string;
	latitude: number;
	longitude: number;
}

/** A GeoJSON layer drawn over the map, as MapView takes it. */
export interface MapLayerData {
	id: string;
	name: string;
	color: string;
	/** The feature property drawn as each shape's label, or null for none. */
	labelField: string | null;
	/**
	 * Whether the layer starts on. Defaults to on when `geojson` is given and off
	 * when it is not, so a map shows no layer the viewer has not asked for.
	 */
	visible?: boolean;
	/**
	 * The shapes, when the caller already has them. Left out, MapView fetches
	 * them the first time the layer is turned on (see MapView `loadLayer`).
	 */
	geojson?: LayerGeoJSON;
}

/**
 * The marker colors as hex. MapLibre paints the dots on a canvas, so it cannot
 * read the `--location-*` tokens; these match them (Tailwind blue-500,
 * green-700, zinc-400, red-800).
 */
export const VARIANT_COLORS: Record<MarkerVariant, string> = {
	unvisited: '#2b7fff',
	contacted: '#008236',
	'no-contact': '#9f9fa9',
	hostile: '#9f0712'
};

export const POINT_SOURCE = 'mv-points';
export const CLUSTER_LAYER = 'mv-clusters';
export const CLUSTER_COUNT_LAYER = 'mv-cluster-count';
export const DOT_LAYER = 'mv-dots';

/** Points closer than this many pixels merge into one bubble. */
export const CLUSTER_RADIUS = 50;
/** Past this zoom nothing clusters, so every point shows on its own. */
export const CLUSTER_MAX_ZOOM = 15;

/** The points as a FeatureCollection, each carrying its id and marker variant. */
export function pointFeatures<T extends MapPoint>(
	points: T[],
	variantFor: (point: T) => MarkerVariant
): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; variant: MarkerVariant }> {
	return {
		type: 'FeatureCollection',
		features: points.map((p) => ({
			type: 'Feature',
			properties: { id: p.id, variant: variantFor(p) },
			geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] }
		}))
	};
}

/**
 * The point source. `promoteId` makes each point's own id its feature id, so
 * the selection can be set as feature state without rebuilding the data.
 */
export function pointSource(
	data: GeoJSON.FeatureCollection,
	cluster: boolean
): SourceSpecification {
	return {
		type: 'geojson',
		data,
		promoteId: 'id',
		cluster,
		clusterRadius: CLUSTER_RADIUS,
		clusterMaxZoom: CLUSTER_MAX_ZOOM
	};
}

const IS_CLUSTER: FilterSpecification = ['has', 'point_count'];
const NOT_CLUSTER: FilterSpecification = ['!', ['has', 'point_count']];

/**
 * The cluster bubbles and their counts. Bubbles grow with the number of points
 * in them. By default MapLibre's own clusters from the point source; the same
 * look serves bubbles the server made (see serverClusterFeatures).
 */
export function clusterLayers(
	source = POINT_SOURCE,
	ids: { bubble: string; count: string } = { bubble: CLUSTER_LAYER, count: CLUSTER_COUNT_LAYER }
): LayerSpecification[] {
	return [
		{
			id: ids.bubble,
			type: 'circle',
			source,
			filter: IS_CLUSTER,
			paint: {
				'circle-color': VARIANT_COLORS.unvisited,
				'circle-opacity': 0.85,
				'circle-radius': ['step', ['get', 'point_count'], 14, 25, 18, 100, 22, 500, 28],
				'circle-stroke-color': '#ffffff',
				'circle-stroke-width': 2
			}
		},
		{
			id: ids.count,
			type: 'symbol',
			source,
			filter: IS_CLUSTER,
			layout: {
				'text-field': ['get', 'point_count_abbreviated'],
				'text-font': ['Noto Sans Bold'],
				'text-size': 12,
				'text-allow-overlap': true
			},
			paint: { 'text-color': '#ffffff' }
		}
	];
}

export const SERVER_CLUSTER_SOURCE = 'mv-server-clusters';
export const SERVER_CLUSTER_LAYER = 'mv-server-clusters';
export const SERVER_CLUSTER_COUNT_LAYER = 'mv-server-cluster-count';

/** Locations the server merged into one bubble, for maps that load per viewport. */
export interface MapCluster {
	id: string;
	latitude: number;
	longitude: number;
	count: number;
}

/** A count as a bubble shows it: 950, 1.2k, 15k. */
export function abbreviateCount(count: number): string {
	if (count < 1000) return String(count);
	const thousands = count / 1000;
	return `${thousands < 10 ? thousands.toFixed(1).replace(/\.0$/, '') : Math.round(thousands)}k`;
}

/**
 * Server bubbles as features shaped like MapLibre's own clusters, so
 * clusterLayers() draws both the same way.
 */
export function serverClusterFeatures(clusters: MapCluster[]): GeoJSON.FeatureCollection {
	return {
		type: 'FeatureCollection',
		features: clusters.map((c) => ({
			type: 'Feature',
			properties: {
				id: c.id,
				server_cluster: true,
				point_count: c.count,
				point_count_abbreviated: abbreviateCount(c.count)
			},
			geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] }
		}))
	};
}

/** Single points drawn as small dots in their variant's color. A selected dot grows and gets a dark ring. */
export function dotLayer(): LayerSpecification {
	const selected = ['boolean', ['feature-state', 'selected'], false];
	return {
		id: DOT_LAYER,
		type: 'circle',
		source: POINT_SOURCE,
		filter: NOT_CLUSTER,
		paint: {
			'circle-color': [
				'match',
				['get', 'variant'],
				'contacted',
				VARIANT_COLORS.contacted,
				'no-contact',
				VARIANT_COLORS['no-contact'],
				'hostile',
				VARIANT_COLORS.hostile,
				VARIANT_COLORS.unvisited
			],
			'circle-radius': ['case', selected, 8, 5],
			'circle-stroke-color': ['case', selected, '#18181b', '#ffffff'],
			'circle-stroke-width': ['case', selected, 3, 1.5]
		}
	} as unknown as LayerSpecification;
}

/** The source id of a GeoJSON layer. */
export function layerSourceId(layerId: string): string {
	return `mv-geo-${layerId}`;
}

/** The style layer ids a GeoJSON layer draws with: fill, line, circle, label. */
export function layerStyleIds(layerId: string): [string, string, string, string] {
	const source = layerSourceId(layerId);
	return [`${source}-fill`, `${source}-line`, `${source}-circle`, `${source}-label`];
}

/** The layer id a style layer belongs to, or null when it is not a GeoJSON layer's. */
export function layerIdOfStyleLayer(styleLayerId: string): string | null {
	return /^mv-geo-(.+)-(fill|line|circle|label)$/.exec(styleLayerId)?.[1] ?? null;
}

/** The text drawn as each shape's label: the chosen property, or nothing. */
export function labelText(labelField: string | null): unknown {
	return labelField ? ['to-string', ['get', labelField]] : '';
}

/**
 * The four style layers that draw a GeoJSON layer: polygons filled, lines and
 * polygon edges stroked, points as circles, and an optional label. Hovered and
 * selected shapes are drawn heavier through feature state.
 */
export function geoLayerSpecs(layer: MapLayerData): LayerSpecification[] {
	const [fillId, lineId, circleId, labelId] = layerStyleIds(layer.id);
	const source = layerSourceId(layer.id);
	const visibility = layer.visible === false ? 'none' : 'visible';
	const state = (selected: number, hover: number, rest: number) => [
		'case',
		['boolean', ['feature-state', 'selected'], false],
		selected,
		['boolean', ['feature-state', 'hover'], false],
		hover,
		rest
	];

	return [
		{
			id: fillId,
			type: 'fill',
			source,
			filter: ['==', '$type', 'Polygon'],
			layout: { visibility },
			paint: { 'fill-color': layer.color, 'fill-opacity': state(0.55, 0.45, 0.3) }
		},
		{
			id: lineId,
			type: 'line',
			source,
			filter: ['any', ['==', '$type', 'LineString'], ['==', '$type', 'Polygon']],
			layout: { visibility },
			paint: { 'line-color': layer.color, 'line-width': state(4, 3, 2) }
		},
		{
			id: circleId,
			type: 'circle',
			source,
			filter: ['==', '$type', 'Point'],
			layout: { visibility },
			paint: {
				'circle-color': layer.color,
				'circle-radius': state(8, 7, 5),
				'circle-stroke-color': '#ffffff',
				'circle-stroke-width': 1.5
			}
		},
		{
			id: labelId,
			type: 'symbol',
			source,
			layout: {
				visibility,
				'text-field': labelText(layer.labelField),
				'text-font': ['Noto Sans Bold'],
				'text-size': 13,
				'text-allow-overlap': false
			},
			paint: { 'text-color': '#18181b', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }
		}
	] as LayerSpecification[];
}
