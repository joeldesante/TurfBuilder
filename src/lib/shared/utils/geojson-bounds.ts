export type Bounds = [west: number, south: number, east: number, north: number];

type Json = Record<string, unknown>;

function extend(bounds: Bounds | null, coordinates: unknown): Bounds | null {
	if (!Array.isArray(coordinates)) return bounds;
	if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
		const [lng, lat] = coordinates as number[];
		if (!Number.isFinite(lng) || !Number.isFinite(lat)) return bounds;
		return bounds
			? [Math.min(bounds[0], lng), Math.min(bounds[1], lat), Math.max(bounds[2], lng), Math.max(bounds[3], lat)]
			: [lng, lat, lng, lat];
	}
	for (const part of coordinates) bounds = extend(bounds, part);
	return bounds;
}

function walk(bounds: Bounds | null, node: unknown): Bounds | null {
	if (!node || typeof node !== 'object') return bounds;
	const item = node as Json;
	switch (item.type) {
		case 'FeatureCollection':
			for (const feature of (item.features as unknown[]) ?? []) bounds = walk(bounds, feature);
			return bounds;
		case 'Feature':
			return walk(bounds, item.geometry);
		case 'GeometryCollection':
			for (const geometry of (item.geometries as unknown[]) ?? []) bounds = walk(bounds, geometry);
			return bounds;
		default:
			return extend(bounds, item.coordinates);
	}
}

/** The box around everything in a GeoJSON object, or null when it has no coordinates. */
export function geojsonBounds(geojson: unknown): Bounds | null {
	return walk(null, geojson);
}
