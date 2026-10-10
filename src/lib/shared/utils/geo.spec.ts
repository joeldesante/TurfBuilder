import { describe, expect, it } from 'vitest';
import { circlePolygon, distanceMiles, isWithinPolygon, isWithinRadius } from './geo';

const philly = { latitude: 39.9526, longitude: -75.1652 };
const nyc = { latitude: 40.7128, longitude: -74.006 };

describe('geo', () => {
	it('measures the distance between two points', () => {
		expect(distanceMiles(philly, nyc)).toBeGreaterThan(75);
		expect(distanceMiles(philly, nyc)).toBeLessThan(85);
		expect(distanceMiles(philly, philly)).toBe(0);
	});

	it('tests whether a point is inside a radius', () => {
		expect(isWithinRadius(philly, { ...nyc, radius: 100 })).toBe(true);
		expect(isWithinRadius(philly, { ...nyc, radius: 50 })).toBe(false);
	});

	it('draws a closed circle whose edge is the radius from the center', () => {
		const ring = circlePolygon(philly, 5).coordinates[0];
		expect(ring[0]).toEqual(ring[ring.length - 1]);
		for (const [longitude, latitude] of ring) {
			expect(distanceMiles(philly, { latitude, longitude })).toBeCloseTo(5, 1);
		}
	});

	it('tests whether a point is inside a polygon, honouring holes', () => {
		const square: GeoJSON.Polygon = {
			type: 'Polygon',
			coordinates: [
				[
					[0, 0],
					[10, 0],
					[10, 10],
					[0, 10],
					[0, 0]
				],
				[
					[4, 4],
					[6, 4],
					[6, 6],
					[4, 6],
					[4, 4]
				]
			]
		};
		expect(isWithinPolygon({ latitude: 2, longitude: 2 }, square)).toBe(true);
		expect(isWithinPolygon({ latitude: 5, longitude: 5 }, square)).toBe(false);
		expect(isWithinPolygon({ latitude: 20, longitude: 2 }, square)).toBe(false);
	});
});
