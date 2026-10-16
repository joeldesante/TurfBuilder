import type { RadiusValue } from '../types/filters';

const EARTH_RADIUS_MILES = 3958.8;

interface Point {
	latitude: number;
	longitude: number;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/** Great-circle distance between two points, in miles. */
export function distanceMiles(a: Point, b: Point): number {
	const dLat = toRadians(b.latitude - a.latitude);
	const dLng = toRadians(b.longitude - a.longitude);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/** Whether a point lies inside a radius filter's circle. */
export function isWithinRadius(point: Point, area: RadiusValue): boolean {
	return distanceMiles(point, area) <= area.radius;
}

/** A closed GeoJSON ring approximating the circle, for drawing it on a map. */
export function circlePolygon(center: Point, radiusMiles: number, steps = 64): GeoJSON.Polygon {
	const lat = toRadians(center.latitude);
	const lng = toRadians(center.longitude);
	const angular = radiusMiles / EARTH_RADIUS_MILES;

	const ring: [number, number][] = [];
	for (let i = 0; i < steps; i++) {
		const bearing = (2 * Math.PI * i) / steps;
		const pointLat = Math.asin(
			Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing)
		);
		const pointLng =
			lng +
			Math.atan2(
				Math.sin(bearing) * Math.sin(angular) * Math.cos(lat),
				Math.cos(angular) - Math.sin(lat) * Math.sin(pointLat)
			);
		ring.push([toDegrees(pointLng), toDegrees(pointLat)]);
	}
	ring.push(ring[0]);

	return { type: 'Polygon', coordinates: [ring] };
}

/**
 * Whether a point lies inside a GeoJSON polygon (ray casting). The first ring
 * is the outline and any others are holes.
 */
export function isWithinPolygon(point: Point, polygon: GeoJSON.Polygon): boolean {
	const inRing = (ring: GeoJSON.Position[]) => {
		let inside = false;
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const [xi, yi] = ring[i];
			const [xj, yj] = ring[j];
			const crosses =
				yi > point.latitude !== yj > point.latitude &&
				point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;
			if (crosses) inside = !inside;
		}
		return inside;
	};

	const [outline, ...holes] = polygon.coordinates;
	return inRing(outline) && !holes.some(inRing);
}

/**
 * The single polygon a drawn shape stands for. The drawing tool saves a drawn
 * polygon as a MultiPolygon of one polygon, which becomes that polygon; a
 * shape that is neither (a point, a line) is not a region and gives null.
 */
export function asSinglePolygon(geometry: GeoJSON.Geometry | null | undefined): GeoJSON.Polygon | null {
	if (geometry?.type === 'Polygon') return geometry;
	if (geometry?.type === 'MultiPolygon' && geometry.coordinates.length > 0) {
		return { type: 'Polygon', coordinates: geometry.coordinates[0] };
	}
	return null;
}
