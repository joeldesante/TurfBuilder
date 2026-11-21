import { render } from 'vitest-browser-svelte';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { page } from 'vitest/browser';

const { mapHandlers, markerInstances, mapApi, popups, sourceData } = vi.hoisted(() => {
	/** The data last handed to each source, so querySourceFeatures can answer from it. */
	const sourceData: Record<string, { features?: { properties: Record<string, unknown> }[] }> = {};
	return {
		sourceData,
		mapHandlers: {} as Record<string, ((event?: unknown) => void)[]>,
		markerInstances: [] as {
			element: HTMLElement;
			draggable: boolean;
			anchor?: string;
			lngLat: [number, number];
			handlers: Record<string, () => void>;
			remove: () => void;
		}[],
		popups: [] as { content: HTMLElement | null; text: string | null; lngLat: unknown }[],
		mapApi: {
			addSource: vi.fn((id: string, spec: { data: never }) => {
				sourceData[id] = spec.data;
			}),
			addLayer: vi.fn(),
			removeLayer: vi.fn(),
			removeSource: vi.fn(),
			moveLayer: vi.fn(),
			setPaintProperty: vi.fn(),
			setLayoutProperty: vi.fn(),
			setFeatureState: vi.fn(),
			getLayer: vi.fn((): unknown => ({})),
			getSource: vi.fn((id: string) => ({
				setData: (data: never) => {
					sourceData[id] = data;
				},
				getClusterExpansionZoom: vi.fn().mockResolvedValue(14)
			})),
			querySourceFeatures: vi.fn((id: string) => sourceData[id]?.features ?? []),
			queryRenderedFeatures: vi.fn((): unknown[] => []),
			getCanvas: vi.fn(() => ({ style: {} as CSSStyleDeclaration })),
			addControl: vi.fn(),
			flyTo: vi.fn(),
			easeTo: vi.fn(),
			getZoom: vi.fn(() => 12),
			fitBounds: vi.fn(),
			getBounds: vi.fn(() => ({
				getWest: (): number => -75.3,
				getSouth: (): number => 39.9,
				getEast: (): number => -75.1,
				getNorth: (): number => 40.1
			}))
		}
	};
});

vi.mock('maplibre-gl', () => {
	// Constructor mocks use function expressions because arrow functions cannot
	// be called with `new`.
	const LngLatBounds = vi.fn(function () {
		const instance = { extend: () => instance };
		return instance;
	});

	const Map = vi.fn(function () {
		return {
			on: vi.fn((event: string, handler: () => void) => {
				(mapHandlers[event] ??= []).push(handler);
			}),
			off: vi.fn(),
			once: vi.fn(),
			remove: vi.fn(),
			setStyle: vi.fn(),
			...mapApi
		};
	});

	const Marker = vi.fn(function (options: {
		element: HTMLElement;
		draggable?: boolean;
		anchor?: string;
	}) {
		const record = {
			element: options.element,
			draggable: options.draggable ?? false,
			anchor: options.anchor,
			lngLat: [0, 0] as [number, number],
			handlers: {} as Record<string, () => void>,
			remove: vi.fn()
		};
		markerInstances.push(record);
		const instance = {
			setLngLat: (c: [number, number]) => {
				record.lngLat = c;
				return instance;
			},
			addTo: () => instance,
			remove: record.remove,
			on: (event: string, handler: () => void) => {
				record.handlers[event] = handler;
				return instance;
			},
			getLngLat: () => ({ lng: record.lngLat[0], lat: record.lngLat[1] })
		};
		return instance;
	});

	const Popup = vi.fn(function () {
		const record = { content: null as HTMLElement | null, text: null as string | null, lngLat: null as unknown };
		popups.push(record);
		const instance = {
			setLngLat: (c: unknown) => {
				record.lngLat = c;
				return instance;
			},
			setDOMContent: (el: HTMLElement) => {
				record.content = el;
				return instance;
			},
			setText: (text: string) => {
				record.text = text;
				return instance;
			},
			addTo: () => instance,
			on: () => instance,
			remove: () => instance
		};
		return instance;
	});

	const GeolocateControl = vi.fn(function () {
		return {};
	});

	// Named exports and the default namespace both carry the constructors because
	// the CJS interop can hand the component either shape.
	const namespace = { Map, Marker, Popup, GeolocateControl, LngLatBounds };
	return { ...namespace, default: namespace };
});

vi.mock('$lib/map-style', () => ({
	getMapStyle: vi.fn().mockResolvedValue({})
}));

vi.mock('$lib/theme.svelte', () => ({
	themeStore: { theme: 'light', setTheme: vi.fn(), init: vi.fn() }
}));

import maplibregl from 'maplibre-gl';
import MapView from './MapView.svelte';

const locations = [
	{
		id: 'loc-1',
		name: 'Community Center',
		address_line_1: '100 Main St',
		city: 'Philadelphia',
		latitude: 40.0259,
		longitude: -75.2238
	},
	{
		id: 'loc-2',
		name: 'Public Library',
		address_line_1: '250 Market St',
		city: 'Philadelphia',
		latitude: 40.031,
		longitude: -75.218
	}
];

const wards = {
	id: 'layer-1',
	name: 'Wards',
	color: '#2f6fed',
	labelField: null,
	geojson: { type: 'FeatureCollection', features: [] }
};

function fireMapEvent(event: string, payload?: unknown) {
	for (const handler of mapHandlers[event] ?? []) handler(payload);
}

/** Pins built for locations: every marker that is not a draft pin, handle, or viewer dot. */
function pins() {
	return markerInstances.filter(
		(m) => !m.element.dataset.testid && m.element.className !== 'map-view-user-dot'
	);
}

beforeEach(() => {
	for (const key of Object.keys(mapHandlers)) delete mapHandlers[key];
	for (const key of Object.keys(sourceData)) delete sourceData[key];
	markerInstances.length = 0;
	popups.length = 0;
	vi.clearAllMocks();
	mapApi.getLayer.mockReturnValue({});
	mapApi.queryRenderedFeatures.mockReturnValue([]);
	mapApi.getCanvas.mockReturnValue({ style: {} as CSSStyleDeclaration });
	mapApi.getBounds.mockReturnValue({
		getWest: () => -75.3,
		getSouth: () => 39.9,
		getEast: () => -75.1,
		getNorth: () => 40.1
	});
});

/** Waits for the map to be constructed, then fires 'load' so it draws. */
async function loadMap() {
	await vi.waitFor(() => {
		if (!mapHandlers['load']) throw new Error('map not initialized yet');
	});
	fireMapEvent('load');
	await vi.waitFor(() => {
		if (!mapApi.addSource.mock.calls.some((c) => c[0] === 'mv-points')) {
			throw new Error('points not drawn yet');
		}
	});
}

test('renders the map container', async () => {
	const { getByTestId } = render(MapView, { props: { locations, class: 'w-96 h-96' } });

	await expect.element(getByTestId('map-view')).toBeInTheDocument();
});

test('shows the loading indicator while locations are loading', async () => {
	const { getByText } = render(MapView, {
		props: { locations: [], locationsLoading: true, class: 'w-96 h-96' }
	});

	await expect.element(getByText('Loading locations...')).toBeVisible();
});

test('shows the loaded count once the map is idle', async () => {
	const { getByText } = render(MapView, { props: { locations, class: 'w-96 h-96' } });

	await vi.waitFor(() => {
		if (!mapHandlers['idle']) throw new Error('map not initialized yet');
	});
	fireMapEvent('idle');

	await expect.element(getByText('2 locations loaded')).toBeVisible();
});

test('counts layers once loaded when there are no locations', async () => {
	const { getByText } = render(MapView, { props: { layers: [wards], class: 'w-96 h-96' } });

	await vi.waitFor(() => {
		if (!mapHandlers['idle']) throw new Error('map not initialized yet');
	});
	fireMapEvent('idle');

	await expect.element(getByText('1 layer loaded')).toBeVisible();
});

test('puts the locations in one clustered source', async () => {
	render(MapView, { props: { locations, class: 'w-96 h-96' } });

	await loadMap();

	const [, spec] = mapApi.addSource.mock.calls.find((c) => c[0] === 'mv-points')!;
	expect(spec).toMatchObject({ type: 'geojson', cluster: true });
	expect((spec as { data: { features: unknown[] } }).data.features).toHaveLength(2);
	const layerIds = mapApi.addLayer.mock.calls.map((c) => (c[0] as { id: string }).id);
	expect(layerIds).toEqual(expect.arrayContaining(['mv-clusters', 'mv-cluster-count']));
});

test('leaves clustering off when asked', async () => {
	render(MapView, { props: { locations, cluster: false, class: 'w-96 h-96' } });

	await loadMap();

	const [, spec] = mapApi.addSource.mock.calls.find((c) => c[0] === 'mv-points')!;
	expect(spec).toMatchObject({ cluster: false });
	const layerIds = mapApi.addLayer.mock.calls.map((c) => (c[0] as { id: string }).id);
	expect(layerIds).not.toContain('mv-clusters');
});

test('builds a pin for each single location MapLibre has placed', async () => {
	render(MapView, { props: { locations, class: 'w-96 h-96' } });

	await loadMap();

	await vi.waitFor(() => expect(pins()).toHaveLength(2));
});

test('builds no pin for a location merged into a bubble', async () => {
	render(MapView, { props: { locations, class: 'w-96 h-96' } });
	await loadMap();
	await vi.waitFor(() => expect(pins()).toHaveLength(2));

	// Zoomed out: MapLibre now reports one cluster and one single location.
	sourceData['mv-points'] = {
		features: [
			{ properties: { cluster: true, cluster_id: 1, point_count: 5 } },
			{ properties: { id: 'loc-2', variant: 'unvisited' } }
		]
	};
	fireMapEvent('moveend');

	expect(pins()[0].remove).toHaveBeenCalled();
	expect(pins()).toHaveLength(2);
	expect(maplibregl.Marker).toHaveBeenCalledTimes(2);
});

test('draws dots on the canvas instead of pins when markerStyle is dot', async () => {
	render(MapView, { props: { locations, markerStyle: 'dot', class: 'w-96 h-96' } });

	await loadMap();

	const layerIds = mapApi.addLayer.mock.calls.map((c) => (c[0] as { id: string }).id);
	expect(layerIds).toContain('mv-dots');
	expect(pins()).toHaveLength(0);
});

test('each pin is a named button that Enter selects', async () => {
	const props = $state({ locations, selectedLocationId: null as string | null, class: 'w-96 h-96' });
	render(MapView, { props });

	await loadMap();
	await vi.waitFor(() => expect(pins()).toHaveLength(2));
	const element = pins()[1].element;
	expect(element.getAttribute('role')).toBe('button');
	expect(element.tabIndex).toBe(0);
	expect(element.getAttribute('aria-label')).toContain(locations[1].name);
	element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

	await vi.waitFor(() => expect(props.selectedLocationId).toBe('loc-2'));
});

test('selects a clicked pin and opens its default popup', async () => {
	const props = $state({ locations, selectedLocationId: null as string | null, class: 'w-96 h-96' });
	render(MapView, { props });

	await loadMap();
	await vi.waitFor(() => expect(pins()).toHaveLength(2));
	pins()[1].element.click();

	await vi.waitFor(() => expect(props.selectedLocationId).toBe('loc-2'));
	const content = popups.find((p) => p.content)?.content;
	expect(content?.textContent).toContain('Public Library');
});

test('suppresses popups when popup is null', async () => {
	render(MapView, { props: { locations, popup: null, class: 'w-96 h-96' } });

	await loadMap();
	await vi.waitFor(() => expect(pins()).toHaveLength(2));
	pins()[0].element.click();

	expect(popups.some((p) => p.content)).toBe(false);
});

test('selects a clicked dot', async () => {
	const props = $state({
		locations,
		markerStyle: 'dot' as const,
		selectedLocationId: null as string | null,
		class: 'w-96 h-96'
	});
	render(MapView, { props });

	await loadMap();
	mapApi.queryRenderedFeatures.mockReturnValue([{ properties: { id: 'loc-1' } }]);
	fireMapEvent('click', { point: { x: 1, y: 1 }, lngLat: { lat: 40, lng: -75 } });

	await vi.waitFor(() => expect(props.selectedLocationId).toBe('loc-1'));
	expect(mapApi.setFeatureState).toHaveBeenCalledWith(
		{ source: 'mv-points', id: 'loc-1' },
		{ selected: true }
	);
});

test('zooms into a clicked bubble', async () => {
	render(MapView, { props: { locations, class: 'w-96 h-96' } });

	await loadMap();
	mapApi.queryRenderedFeatures.mockReturnValue([
		{
			properties: { cluster: true, cluster_id: 7 },
			geometry: { type: 'Point', coordinates: [-75.2, 40.02] }
		}
	]);
	fireMapEvent('click', { point: { x: 1, y: 1 }, lngLat: { lat: 40, lng: -75 } });

	await vi.waitFor(() =>
		expect(mapApi.easeTo).toHaveBeenCalledWith({ center: [-75.2, 40.02], zoom: 14 })
	);
});

test('colours each pin through variantFor', async () => {
	const variantFor = vi.fn((loc: { id: string }) =>
		loc.id === 'loc-1' ? ('contacted' as const) : ('no-contact' as const)
	);
	render(MapView, { props: { locations, variantFor, class: 'w-96 h-96' } });

	await loadMap();
	await vi.waitFor(() => expect(pins()).toHaveLength(2));

	expect(pins()[0].element.querySelector('.fill-location-contacted')).not.toBeNull();
	expect(pins()[1].element.querySelector('.fill-location-no-contact')).not.toBeNull();
	const [, spec] = mapApi.addSource.mock.calls.find((c) => c[0] === 'mv-points')!;
	const variants = (spec as { data: { features: { properties: { variant: string } }[] } }).data.features.map(
		(f) => f.properties.variant
	);
	expect(variants).toEqual(['contacted', 'no-contact']);
});

test('reports a map click as a pin drop when pinDropMode is on', async () => {
	const onPinDrop = vi.fn();
	render(MapView, { props: { locations, pinDropMode: true, onPinDrop, class: 'w-96 h-96' } });

	await loadMap();
	await vi.waitFor(() => {
		if ((mapHandlers['click'] ?? []).length < 2) throw new Error('pin drop handler not registered yet');
	});
	fireMapEvent('click', { point: { x: 1, y: 1 }, lngLat: { lat: 40.5, lng: -75.5 } });

	expect(onPinDrop).toHaveBeenCalledWith({ latitude: 40.5, longitude: -75.5 });
});

test('keeps the draggable location out of the bubbles and lets it be dragged', async () => {
	const onLocationMove = vi.fn();
	render(MapView, {
		props: { locations, draggableLocationId: 'loc-2', onLocationMove, class: 'w-96 h-96' }
	});

	await loadMap();
	const [, spec] = mapApi.addSource.mock.calls.find((c) => c[0] === 'mv-points')!;
	expect((spec as { data: { features: unknown[] } }).data.features).toHaveLength(1);

	await vi.waitFor(() => expect(markerInstances.some((m) => m.draggable)).toBe(true));
	const dragged = markerInstances.find((m) => m.draggable)!;
	dragged.lngLat = [-75.1, 40.9];
	dragged.handlers['dragend']();

	expect(onLocationMove).toHaveBeenCalledWith('loc-2', { latitude: 40.9, longitude: -75.1 });
});

test('draws the bounds outline when boundsGeoJSON is supplied', async () => {
	const boundsGeoJSON: GeoJSON.Polygon = {
		type: 'Polygon',
		coordinates: [
			[
				[-75.3, 40.0],
				[-75.1, 40.0],
				[-75.1, 40.1],
				[-75.3, 40.1],
				[-75.3, 40.0]
			]
		]
	};
	render(MapView, { props: { locations, boundsGeoJSON, class: 'w-96 h-96' } });

	await loadMap();

	expect(mapApi.addSource).toHaveBeenCalledWith('mv-bounds', expect.anything());
});

test('draws each layer from its own source, top of the list on top', async () => {
	const parks = { ...wards, id: 'layer-2', name: 'Parks', color: '#2a9d4b' };
	render(MapView, { props: { layers: [wards, parks], class: 'w-96 h-96' } });

	await loadMap();

	await vi.waitFor(() =>
		expect(mapApi.addSource).toHaveBeenCalledWith('mv-geo-layer-1', expect.objectContaining({ type: 'geojson' }))
	);
	expect(mapApi.addSource).toHaveBeenCalledWith('mv-geo-layer-2', expect.anything());
	// Moved from the bottom up, so the first layer is moved last and ends on top.
	const moved = mapApi.moveLayer.mock.calls.map((c) => c[0]);
	expect(moved.indexOf('mv-geo-layer-2-fill')).toBeLessThan(moved.indexOf('mv-geo-layer-1-fill'));
});

test('draws no layers when showLayers is off', async () => {
	render(MapView, { props: { layers: [wards], showLayers: false, class: 'w-96 h-96' } });

	await loadMap();

	expect(mapApi.addSource).not.toHaveBeenCalledWith('mv-geo-layer-1', expect.anything());
});

test('hides a layer that is not visible', async () => {
	const props = $state({ layers: [{ ...wards, visible: true }], class: 'w-96 h-96' });
	render(MapView, { props });
	await loadMap();
	await vi.waitFor(() => expect(mapApi.addSource).toHaveBeenCalledWith('mv-geo-layer-1', expect.anything()));

	props.layers[0].visible = false;

	await vi.waitFor(() =>
		expect(mapApi.setLayoutProperty).toHaveBeenCalledWith('mv-geo-layer-1-fill', 'visibility', 'none')
	);
});

test('shows the properties of a clicked layer shape', async () => {
	render(MapView, { props: { layers: [wards], class: 'w-96 h-96' } });
	await loadMap();
	await vi.waitFor(() => expect(mapApi.addSource).toHaveBeenCalledWith('mv-geo-layer-1', expect.anything()));

	// Nothing at the point among the locations; a ward shape under it.
	mapApi.queryRenderedFeatures.mockImplementation((...args: unknown[]) => {
		const options = args[1] as { layers: string[] };
		return options.layers.includes('mv-geo-layer-1-fill')
			? [{ id: 3, source: 'mv-geo-layer-1', properties: { WARD: '5' } }]
			: [];
	});
	fireMapEvent('click', { point: { x: 1, y: 1 }, lngLat: { lat: 40, lng: -75 } });

	await vi.waitFor(() => {
		const content = popups.find((p) => p.content)?.content;
		expect(content?.textContent).toContain('Wards');
		expect(content?.textContent).toContain('WARD');
	});
});

test('adds the geolocate control only when asked', async () => {
	render(MapView, { props: { locations, geolocate: true, class: 'w-96 h-96' } });

	await vi.waitFor(() => expect(mapApi.addControl).toHaveBeenCalledTimes(1));
});

test('draws a draft pin for a location that does not exist yet and reports where it is dragged', async () => {
	const onDraftMove = vi.fn();
	render(MapView, {
		props: { locations, draftPin: { latitude: 40.5, longitude: -75.5 }, onDraftMove, class: 'w-96 h-96' }
	});

	await loadMap();

	const draft = await vi.waitFor(() => {
		const found = markerInstances.find((m) => m.element.dataset.testid === 'draft-pin');
		if (!found) throw new Error('no draft pin yet');
		return found;
	});
	expect(draft.draggable).toBe(true);
	expect(draft.lngLat).toEqual([-75.5, 40.5]);
	draft.lngLat = [-75.4, 40.6];
	draft.handlers['dragend']();

	expect(onDraftMove).toHaveBeenCalledWith({ latitude: 40.6, longitude: -75.4 });
});

test('reports the handle position continuously while it is dragged', async () => {
	const onHandleDrag = vi.fn();
	render(MapView, {
		props: { locations, handle: { latitude: 40.5, longitude: -75.5 }, onHandleDrag, class: 'w-96 h-96' }
	});

	await loadMap();

	const grip = markerInstances.find((m) => m.element.dataset.testid === 'map-handle')!;
	expect(grip.draggable).toBe(true);
	grip.lngLat = [-75.4, 40.5];
	grip.handlers['drag']();

	expect(onHandleDrag).toHaveBeenCalledWith({ latitude: 40.5, longitude: -75.4 });
});

test('draws the viewer position as a centred dot, and none without a position', async () => {
	render(MapView, {
		props: { locations, userPosition: { latitude: 39.95, longitude: -75.16 }, class: 'w-96 h-96' }
	});

	await loadMap();

	const dot = markerInstances.find((m) => m.element.className === 'map-view-user-dot')!;
	expect(dot.anchor).toBe('center');
	expect(dot.lngLat).toEqual([-75.16, 39.95]);
});

// A caller that loads locations per viewport has nothing to load until the map
// says where it opened, so the first report cannot wait for a pan.
test('reports the opening viewport, and again once the map settles', async () => {
	const onViewportChange = vi.fn();
	render(MapView, { props: { locations, onViewportChange, class: 'w-96 h-96' } });

	await loadMap();
	expect(onViewportChange).toHaveBeenCalledWith({ west: -75.3, south: 39.9, east: -75.1, north: 40.1 }, 12);

	onViewportChange.mockClear();
	mapApi.getBounds.mockReturnValue({
		getWest: () => -80,
		getSouth: () => 35,
		getEast: () => -79,
		getNorth: () => 36
	});
	fireMapEvent('moveend');

	expect(onViewportChange).toHaveBeenCalledWith({ west: -80, south: 35, east: -79, north: 36 }, 12);
});

test('stays silent without a viewport listener', async () => {
	render(MapView, { props: { locations, class: 'w-96 h-96' } });

	await loadMap();
	fireMapEvent('moveend');

	expect(mapApi.getBounds).not.toHaveBeenCalled();
});

test('opens on initialBounds rather than fitting to the locations', async () => {
	render(MapView, {
		props: {
			locations,
			initialBounds: { west: -75.5, south: 39.8, east: -75.0, north: 40.2 },
			class: 'w-96 h-96'
		}
	});

	await vi.waitFor(() =>
		expect(maplibregl.LngLatBounds).toHaveBeenCalledWith([-75.5, 39.8], [-75.0, 40.2])
	);
});

test('draws everything again after the map style is replaced', async () => {
	render(MapView, { props: { locations, layers: [wards], class: 'w-96 h-96' } });
	await loadMap();
	await vi.waitFor(() => expect(mapApi.addSource).toHaveBeenCalledWith('mv-geo-layer-1', expect.anything()));
	mapApi.addSource.mockClear();

	fireMapEvent('style.load');

	await vi.waitFor(() => {
		const ids = mapApi.addSource.mock.calls.map((c) => c[0]);
		expect(ids).toEqual(expect.arrayContaining(['mv-points', 'mv-geo-layer-1']));
	});
});

test('shows no layer list unless asked', async () => {
	render(MapView, { props: { layers: [wards], class: 'w-96 h-96' } });

	await loadMap();

	await expect.element(page.getByRole('button', { name: 'Layers' })).not.toBeInTheDocument();
});

test('opens a list of the layers when layerToggles is on', async () => {
	const parks = { ...wards, id: 'layer-2', name: 'Parks', visible: false };
	render(MapView, { props: { layers: [wards, parks], layerToggles: true, class: 'w-96 h-96' } });
	await page.getByRole('button', { name: 'Layers' }).click();

	await expect.element(page.getByRole('checkbox', { name: 'Wards' })).toBeChecked();
	await expect.element(page.getByRole('checkbox', { name: 'Parks' })).not.toBeChecked();
});

test('hides a layer the viewer unchecks and shows it again when checked', async () => {
	render(MapView, { props: { layers: [wards], layerToggles: true, class: 'w-96 h-96' } });
	await loadMap();
	await vi.waitFor(() => expect(mapApi.addSource).toHaveBeenCalledWith('mv-geo-layer-1', expect.anything()));

	await page.getByRole('button', { name: 'Layers' }).click();
	await page.getByRole('checkbox', { name: 'Wards' }).click();

	await vi.waitFor(() =>
		expect(mapApi.setLayoutProperty).toHaveBeenCalledWith('mv-geo-layer-1-fill', 'visibility', 'none')
	);

	await page.getByRole('checkbox', { name: 'Wards' }).click();

	await vi.waitFor(() =>
		expect(mapApi.setLayoutProperty).toHaveBeenLastCalledWith('mv-geo-layer-1-label', 'visibility', 'visible')
	);
});

test('draws server bubbles in their own source and zooms in two levels on a clicked one', async () => {
	render(MapView, {
		props: { clusters: [{ id: 'c1', latitude: 40, longitude: -75.2, count: 1200 }], class: 'w-96 h-96' }
	});
	await vi.waitFor(() => {
		if (!mapHandlers['load']) throw new Error('map not initialized yet');
	});
	fireMapEvent('load');

	await vi.waitFor(() =>
		expect(mapApi.addSource).toHaveBeenCalledWith('mv-server-clusters', expect.objectContaining({ type: 'geojson' }))
	);
	const [, spec] = mapApi.addSource.mock.calls.find((c) => c[0] === 'mv-server-clusters')!;
	expect((spec as { data: { features: { properties: { point_count_abbreviated: string } }[] } }).data.features[0].properties.point_count_abbreviated).toBe('1.2k');

	mapApi.queryRenderedFeatures.mockReturnValue([
		{ properties: { server_cluster: true, id: 'c1' }, geometry: { type: 'Point', coordinates: [-75.2, 40] } }
	]);
	fireMapEvent('click', { point: { x: 1, y: 1 }, lngLat: { lat: 40, lng: -75.2 } });

	await vi.waitFor(() => expect(mapApi.easeTo).toHaveBeenCalledWith({ center: [-75.2, 40], zoom: 14 }));
});

describe('layers passed without their shapes', () => {
	const summary = { id: 'layer-9', name: 'Census', color: '#8a4fd6', labelField: null };
	const shapes = { type: 'FeatureCollection', features: [] };

	test('start off and fetch nothing', async () => {
		const loadLayer = vi.fn().mockResolvedValue(shapes);
		render(MapView, { props: { layers: [summary], layerToggles: true, loadLayer, class: 'w-96 h-96' } });
		await loadMap();

		await page.getByRole('button', { name: 'Layers' }).click();

		await expect.element(page.getByRole('checkbox', { name: 'Census' })).not.toBeChecked();
		expect(loadLayer).not.toHaveBeenCalled();
		expect(mapApi.addSource).not.toHaveBeenCalledWith('mv-geo-layer-9', expect.anything());
	});

	test('are fetched once when turned on, then drawn', async () => {
		const loadLayer = vi.fn().mockResolvedValue(shapes);
		render(MapView, { props: { layers: [summary], layerToggles: true, loadLayer, class: 'w-96 h-96' } });
		await loadMap();
		await page.getByRole('button', { name: 'Layers' }).click();

		await page.getByRole('checkbox', { name: 'Census' }).click();

		await vi.waitFor(() =>
			expect(mapApi.addSource).toHaveBeenCalledWith('mv-geo-layer-9', expect.objectContaining({ data: shapes }))
		);
		await page.getByRole('checkbox', { name: 'Census' }).click();
		await page.getByRole('checkbox', { name: 'Census' }).click();
		expect(loadLayer).toHaveBeenCalledTimes(1);
		expect(loadLayer).toHaveBeenCalledWith('layer-9');
	});

	test('turn back off when they cannot be fetched', async () => {
		const loadLayer = vi.fn().mockRejectedValue(new Error('offline'));
		render(MapView, { props: { layers: [summary], layerToggles: true, loadLayer, class: 'w-96 h-96' } });
		await loadMap();
		await page.getByRole('button', { name: 'Layers' }).click();

		await page.getByRole('checkbox', { name: 'Census' }).click();

		await expect.element(page.getByRole('checkbox', { name: 'Census' })).not.toBeChecked();
	});
});
