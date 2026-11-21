import { describe, expect, it } from 'vitest';
import { geojsonGeometryCounts } from './geojson-geometry';

const feature = (geometry: unknown) => ({ type: 'Feature', properties: {}, geometry });

describe('geojsonGeometryCounts', () => {
	it('counts each kind of shape in a collection', () => {
		const collection = {
			type: 'FeatureCollection',
			features: [
				feature({ type: 'Polygon', coordinates: [] }),
				feature({ type: 'MultiPolygon', coordinates: [] }),
				feature({ type: 'LineString', coordinates: [] }),
				feature({ type: 'Point', coordinates: [0, 0] }),
				feature({ type: 'MultiPoint', coordinates: [] })
			]
		};
		expect(geojsonGeometryCounts(collection)).toEqual({ polygon: 2, line: 1, point: 2 });
	});

	it('reads bare geometry and geometry collections', () => {
		expect(geojsonGeometryCounts({ type: 'Point', coordinates: [0, 0] }).point).toBe(1);
		expect(
			geojsonGeometryCounts({
				type: 'GeometryCollection',
				geometries: [{ type: 'LineString', coordinates: [] }, { type: 'Polygon', coordinates: [] }]
			})
		).toEqual({ polygon: 1, line: 1, point: 0 });
	});

	it('ignores features with no geometry', () => {
		expect(geojsonGeometryCounts({ type: 'FeatureCollection', features: [feature(null)] })).toEqual({
			polygon: 0,
			line: 0,
			point: 0
		});
	});
});
