export type GeometryKind = 'polygon' | 'line' | 'point';

export type GeometryCounts = Record<GeometryKind, number>;

const KIND_OF: Record<string, GeometryKind> = {
	Point: 'point',
	MultiPoint: 'point',
	LineString: 'line',
	MultiLineString: 'line',
	Polygon: 'polygon',
	MultiPolygon: 'polygon'
};

function count(counts: GeometryCounts, node: unknown) {
	if (!node || typeof node !== 'object') return;
	const item = node as { type?: unknown; features?: unknown; geometry?: unknown; geometries?: unknown };
	if (item.type === 'FeatureCollection') {
		for (const feature of Array.isArray(item.features) ? item.features : []) count(counts, feature);
	} else if (item.type === 'Feature') {
		count(counts, item.geometry);
	} else if (item.type === 'GeometryCollection') {
		for (const geometry of Array.isArray(item.geometries) ? item.geometries : []) count(counts, geometry);
	} else if (typeof item.type === 'string' && item.type in KIND_OF) {
		counts[KIND_OF[item.type]]++;
	}
}

/** How many polygons, lines and points a GeoJSON object holds. A multi-part shape counts once. */
export function geojsonGeometryCounts(geojson: unknown): GeometryCounts {
	const counts: GeometryCounts = { polygon: 0, line: 0, point: 0 };
	count(counts, geojson);
	return counts;
}
