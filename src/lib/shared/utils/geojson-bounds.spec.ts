import { describe, expect, it } from 'vitest';
import { geojsonBounds } from './geojson-bounds';

describe('geojsonBounds', () => {
	it('bounds a point', () => {
		expect(geojsonBounds({ type: 'Point', coordinates: [-75, 40] })).toEqual([-75, 40, -75, 40]);
	});

	it('bounds a polygon inside a feature collection', () => {
		const collection = {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					properties: {},
					geometry: {
						type: 'Polygon',
						coordinates: [
							[
								[-76, 39],
								[-74, 39],
								[-74, 41],
								[-76, 39]
							]
						]
					}
				},
				{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-70, 42] } }
			]
		};
		expect(geojsonBounds(collection)).toEqual([-76, 39, -70, 42]);
	});

	it('reads geometry collections', () => {
		expect(
			geojsonBounds({
				type: 'GeometryCollection',
				geometries: [{ type: 'LineString', coordinates: [[1, 2], [3, 4]] }]
			})
		).toEqual([1, 2, 3, 4]);
	});

	it('returns null when there is nothing to bound', () => {
		expect(geojsonBounds({ type: 'FeatureCollection', features: [] })).toBeNull();
		expect(geojsonBounds({ type: 'Feature', geometry: null })).toBeNull();
	});
});
