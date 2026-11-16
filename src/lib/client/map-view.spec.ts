import { describe, expect, it } from 'vitest';
import {
	CLUSTER_LAYER,
	DOT_LAYER,
	POINT_SOURCE,
	clusterLayers,
	dotLayer,
	geoLayerSpecs,
	labelText,
	layerIdOfStyleLayer,
	layerSourceId,
	layerStyleIds,
	pointFeatures,
	pointSource,
	abbreviateCount,
	serverClusterFeatures,
	SERVER_CLUSTER_SOURCE
} from './map-view';

const layer = {
	id: 'abc',
	name: 'Wards',
	color: '#2f6fed',
	labelField: null,
	geojson: { type: 'FeatureCollection', features: [] }
};

describe('pointFeatures', () => {
	it('puts each point at longitude, latitude with its id and variant', () => {
		const data = pointFeatures(
			[
				{ id: 'a', latitude: 40, longitude: -75 },
				{ id: 'b', latitude: 41, longitude: -76 }
			],
			(p) => (p.id === 'a' ? 'contacted' : 'unvisited')
		);

		expect(data.features).toEqual([
			{
				type: 'Feature',
				properties: { id: 'a', variant: 'contacted' },
				geometry: { type: 'Point', coordinates: [-75, 40] }
			},
			{
				type: 'Feature',
				properties: { id: 'b', variant: 'unvisited' },
				geometry: { type: 'Point', coordinates: [-76, 41] }
			}
		]);
	});
});

describe('pointSource', () => {
	it('clusters when asked and keys features by their own id', () => {
		const data = pointFeatures([], () => 'unvisited');

		expect(pointSource(data, true)).toMatchObject({ type: 'geojson', cluster: true, promoteId: 'id' });
		expect(pointSource(data, false)).toMatchObject({ cluster: false });
	});
});

describe('point style layers', () => {
	it('draws clusters only for clustered features and dots only for single points', () => {
		const [bubbles, counts] = clusterLayers();

		expect(bubbles).toMatchObject({ id: CLUSTER_LAYER, source: POINT_SOURCE, filter: ['has', 'point_count'] });
		expect(counts).toMatchObject({ source: POINT_SOURCE });
		expect(dotLayer()).toMatchObject({
			id: DOT_LAYER,
			source: POINT_SOURCE,
			filter: ['!', ['has', 'point_count']]
		});
	});
});

describe('GeoJSON layer ids', () => {
	it('names the source and the four style layers after the layer id', () => {
		expect(layerSourceId('abc')).toBe('mv-geo-abc');
		expect(layerStyleIds('abc')).toEqual([
			'mv-geo-abc-fill',
			'mv-geo-abc-line',
			'mv-geo-abc-circle',
			'mv-geo-abc-label'
		]);
	});

	it('finds the layer id of its own style layers, uuids included, and nothing else', () => {
		const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

		expect(layerIdOfStyleLayer(`mv-geo-${id}-line`)).toBe(id);
		expect(layerIdOfStyleLayer('mv-dots')).toBeNull();
		expect(layerIdOfStyleLayer('water')).toBeNull();
	});
});

describe('geoLayerSpecs', () => {
	it('draws every part in the layer color from the layer source', () => {
		const specs = geoLayerSpecs(layer);

		expect(specs.map((s) => s.id)).toEqual(layerStyleIds('abc'));
		expect(specs.every((s) => (s as { source?: string }).source === 'mv-geo-abc')).toBe(true);
		expect(specs[0]).toMatchObject({ paint: { 'fill-color': '#2f6fed' } });
		expect(specs[1]).toMatchObject({ paint: { 'line-color': '#2f6fed' } });
		expect(specs[2]).toMatchObject({ paint: { 'circle-color': '#2f6fed' } });
	});

	it('starts hidden for a hidden layer', () => {
		const specs = geoLayerSpecs({ ...layer, visible: false });

		expect(specs.every((s) => s.layout?.visibility === 'none')).toBe(true);
	});

	it('labels shapes with the chosen property, or not at all', () => {
		expect(labelText(null)).toBe('');
		expect(labelText('NAME')).toEqual(['to-string', ['get', 'NAME']]);
		expect(geoLayerSpecs({ ...layer, labelField: 'NAME' })[3].layout).toMatchObject({
			'text-field': ['to-string', ['get', 'NAME']]
		});
	});
});

describe('server bubbles', () => {
	it('abbreviates large counts', () => {
		expect(abbreviateCount(950)).toBe('950');
		expect(abbreviateCount(1000)).toBe('1k');
		expect(abbreviateCount(1250)).toBe('1.3k');
		expect(abbreviateCount(15400)).toBe('15k');
	});

	it('are shaped like MapLibre clusters so the same layers draw them', () => {
		const data = serverClusterFeatures([{ id: 'c1', latitude: 40, longitude: -75, count: 1200 }]);

		expect(data.features[0]).toEqual({
			type: 'Feature',
			properties: { id: 'c1', server_cluster: true, point_count: 1200, point_count_abbreviated: '1.2k' },
			geometry: { type: 'Point', coordinates: [-75, 40] }
		});
		const [bubble] = clusterLayers(SERVER_CLUSTER_SOURCE, { bubble: 'b', count: 'c' });
		expect(bubble).toMatchObject({ id: 'b', source: SERVER_CLUSTER_SOURCE, filter: ['has', 'point_count'] });
	});
});
