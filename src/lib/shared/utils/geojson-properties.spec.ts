import { describe, expect, it } from 'vitest';
import { geojsonPropertyKeys } from './geojson-properties';

const feature = (properties: unknown) => ({ type: 'Feature', geometry: null, properties });

describe('geojsonPropertyKeys', () => {
	it('lists the property names across features without repeats', () => {
		const collection = {
			type: 'FeatureCollection',
			features: [feature({ ward_num: 1, name: 'A' }), feature({ ward_num: 2, area: 5 })]
		};
		expect(geojsonPropertyKeys(collection)).toEqual(['ward_num', 'name', 'area']);
	});

	it('reads a single feature', () => {
		expect(geojsonPropertyKeys(feature({ id: 1 }))).toEqual(['id']);
	});

	it('returns nothing for bare geometry, missing or odd properties', () => {
		expect(geojsonPropertyKeys({ type: 'Point', coordinates: [0, 0] })).toEqual([]);
		expect(
			geojsonPropertyKeys({
				type: 'FeatureCollection',
				features: [feature(null), feature([1, 2]), feature('x')]
			})
		).toEqual([]);
	});
});
