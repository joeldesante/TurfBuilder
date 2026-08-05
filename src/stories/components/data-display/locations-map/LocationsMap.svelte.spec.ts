import { render } from 'vitest-browser-svelte';
import { expect, test, vi, beforeEach } from 'vitest';

const { mapHandlers, markerInstances, mapApi, popupContent } = vi.hoisted(() => ({
	mapHandlers: {} as Record<string, ((event?: unknown) => void)[]>,
	markerInstances: [] as {
		element: HTMLElement;
		draggable: boolean;
		anchor?: string;
		lngLat: [number, number];
		handlers: Record<string, () => void>;
	}[],
	mapApi: {
		addSource: vi.fn(),
		addLayer: vi.fn(),
		removeLayer: vi.fn(),
		removeSource: vi.fn(),
		getLayer: vi.fn(() => ({})),
		getSource: vi.fn(() => ({ setData: vi.fn() })),
		getCanvas: vi.fn(() => ({ style: {} as CSSStyleDeclaration })),
		addControl: vi.fn(),
		flyTo: vi.fn()
	},
	popupContent: [] as HTMLElement[]
}));

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
			fitBounds: vi.fn(),
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
			handlers: {} as Record<string, () => void>
		};
		markerInstances.push(record);
		const instance = {
			setLngLat: (c: [number, number]) => {
				record.lngLat = c;
				return instance;
			},
			setPopup: () => instance,
			addTo: () => instance,
			remove: vi.fn(),
			on: (event: string, handler: () => void) => {
				record.handlers[event] = handler;
				return instance;
			},
			getLngLat: () => ({ lng: record.lngLat[0], lat: record.lngLat[1] }),
			getPopup: () => ({ isOpen: () => false }),
			togglePopup: vi.fn()
		};
		return instance;
	});

	const Popup = vi.fn(function () {
		const instance = {
			setDOMContent: (el: HTMLElement) => {
				popupContent.push(el);
				return instance;
			}
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
import LocationsMap from './LocationsMap.svelte';

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

function fireMapEvent(event: string) {
	for (const handler of mapHandlers[event] ?? []) handler();
}

beforeEach(() => {
	for (const key of Object.keys(mapHandlers)) delete mapHandlers[key];
	markerInstances.length = 0;
	popupContent.length = 0;
	vi.clearAllMocks();
	mapApi.getLayer.mockReturnValue({});
	mapApi.getSource.mockReturnValue({ setData: vi.fn() });
	mapApi.getCanvas.mockReturnValue({ style: {} as CSSStyleDeclaration });
});

/** Waits for the map to be constructed, then fires 'load' to draw markers. */
async function loadMap(expected = locations.length) {
	await vi.waitFor(() => {
		if (!mapHandlers['load']) throw new Error('map not initialized yet');
	});
	fireMapEvent('load');
	await vi.waitFor(() => {
		expect(markerInstances.length).toBe(expected);
	});
}

test('renders the map container', async () => {
	const { getByTestId } = render(LocationsMap, {
		props: { locations, class: 'w-96 h-96' }
	});

	await expect.element(getByTestId('locations-map')).toBeInTheDocument();
});

test('shows the loading indicator while locations are loading', async () => {
	const { getByText } = render(LocationsMap, {
		props: { locations: [], locationsLoading: true, class: 'w-96 h-96' }
	});

	await expect.element(getByText('Loading locations...')).toBeVisible();
});

test('shows the loaded count once the map is idle', async () => {
	const { getByText } = render(LocationsMap, {
		props: { locations, class: 'w-96 h-96' }
	});

	await vi.waitFor(() => {
		if (!mapHandlers['idle']) throw new Error('map not initialized yet');
	});
	fireMapEvent('idle');

	await expect.element(getByText('2 locations loaded')).toBeVisible();
});

test('creates a marker for each location once the map has loaded', async () => {
	render(LocationsMap, { props: { locations, class: 'w-96 h-96' } });

	await vi.waitFor(() => {
		if (!mapHandlers['load']) throw new Error('map not initialized yet');
	});
	fireMapEvent('load');

	await vi.waitFor(() => {
		expect(maplibregl.Marker).toHaveBeenCalledTimes(2);
	});
});

test('exposes the clicked location through selectedLocationId', async () => {
	const props = $state({
		locations,
		selectedLocationId: null as string | null,
		class: 'w-96 h-96'
	});
	render(LocationsMap, { props });

	await loadMap();
	markerInstances[1].element.click();

	await vi.waitFor(() => {
		expect(props.selectedLocationId).toBe('loc-2');
	});
});

test('colours each marker through variantFor', async () => {
	const variantFor = vi.fn((loc: { id: string }) =>
		loc.id === 'loc-1' ? ('contacted' as const) : ('no-contact' as const)
	);
	render(LocationsMap, { props: { locations, variantFor, class: 'w-96 h-96' } });

	await loadMap();

	expect(variantFor).toHaveBeenCalled();
	expect(markerInstances[0].element.querySelector('.fill-location-contacted')).not.toBeNull();
	expect(markerInstances[1].element.querySelector('.fill-location-no-contact')).not.toBeNull();
});

test('reports a map click as a pin drop when pinDropMode is on', async () => {
	const onPinDrop = vi.fn();
	render(LocationsMap, {
		props: { locations, pinDropMode: true, onPinDrop, class: 'w-96 h-96' }
	});

	await loadMap();
	await vi.waitFor(() => {
		if (!mapHandlers['click']) throw new Error('click handler not registered yet');
	});
	mapHandlers['click'][0]({ lngLat: { lat: 40.5, lng: -75.5 } });

	expect(onPinDrop).toHaveBeenCalledWith({ latitude: 40.5, longitude: -75.5 });
});

test('does not register a click handler when pinDropMode is off', async () => {
	const onPinDrop = vi.fn();
	render(LocationsMap, { props: { locations, onPinDrop, class: 'w-96 h-96' } });

	await loadMap();

	expect(mapHandlers['click']).toBeUndefined();
	expect(onPinDrop).not.toHaveBeenCalled();
});

test('makes only the named location draggable', async () => {
	render(LocationsMap, {
		props: { locations, draggableLocationId: 'loc-2', class: 'w-96 h-96' }
	});

	await loadMap();

	expect(markerInstances[0].draggable).toBe(false);
	expect(markerInstances[1].draggable).toBe(true);
});

test('reports the new coordinates when a draggable marker is dropped', async () => {
	const onLocationMove = vi.fn();
	render(LocationsMap, {
		props: { locations, draggableLocationId: 'loc-2', onLocationMove, class: 'w-96 h-96' }
	});

	await loadMap();

	const dragged = markerInstances[1];
	dragged.handlers['dragstart']();
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
	render(LocationsMap, { props: { locations, boundsGeoJSON, class: 'w-96 h-96' } });

	await loadMap();

	expect(mapApi.addSource).toHaveBeenCalledWith('location-map-bounds', expect.anything());
	expect(mapApi.addLayer).toHaveBeenCalledTimes(2);
});

// The no-bounds path is the common one and must not touch the map at all.
test('leaves the map alone when no bounds are supplied', async () => {
	render(LocationsMap, { props: { locations, class: 'w-96 h-96' } });

	await loadMap();

	expect(mapApi.addSource).not.toHaveBeenCalled();
	expect(mapApi.removeSource).not.toHaveBeenCalled();
});

test('adds the geolocate control only when asked', async () => {
	render(LocationsMap, { props: { locations, geolocate: true, class: 'w-96 h-96' } });

	await vi.waitFor(() => {
		expect(mapApi.addControl).toHaveBeenCalledTimes(1);
	});
});

test('suppresses popups when popup is null', async () => {
	render(LocationsMap, { props: { locations, popup: null, class: 'w-96 h-96' } });

	await loadMap();

	expect(popupContent).toHaveLength(0);
});

function userDot() {
	return markerInstances.find((m) => m.element.className === 'locations-map-user-dot');
}

test('draws a draft pin for a location that does not exist yet', async () => {
	render(LocationsMap, {
		props: {
			locations,
			draftPin: { latitude: 40.5, longitude: -75.5 },
			class: 'w-96 h-96'
		}
	});

	await loadMap(3);

	const draft = markerInstances.find((m) => m.element.dataset.testid === 'draft-pin')!;
	expect(draft.draggable).toBe(true);
	expect(draft.lngLat).toEqual([-75.5, 40.5]);
});

test('reports the new position when the draft pin is dragged', async () => {
	const onDraftMove = vi.fn();
	render(LocationsMap, {
		props: {
			locations,
			draftPin: { latitude: 40.5, longitude: -75.5 },
			onDraftMove,
			class: 'w-96 h-96'
		}
	});

	await loadMap(3);

	const draft = markerInstances.find((m) => m.element.dataset.testid === 'draft-pin')!;
	draft.lngLat = [-75.4, 40.6];
	draft.handlers['dragend']();

	expect(onDraftMove).toHaveBeenCalledWith({ latitude: 40.6, longitude: -75.4 });
});

test('draws the viewer position as a centred dot', async () => {
	render(LocationsMap, {
		props: { locations, userPosition: { latitude: 39.95, longitude: -75.16 }, class: 'w-96 h-96' }
	});

	await loadMap(3);

	const dot = userDot()!;
	expect(dot.anchor).toBe('center');
	expect(dot.lngLat).toEqual([-75.16, 39.95]);
});

// The dot only appears once the viewer opts into sharing their position.
test('draws no viewer dot without a position', async () => {
	render(LocationsMap, { props: { locations, class: 'w-96 h-96' } });

	await loadMap();

	expect(userDot()).toBeUndefined();
});
