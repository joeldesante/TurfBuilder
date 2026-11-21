import { vi } from 'vitest';

/**
 * A stand-in for maplibre-gl in page specs that render MapView. Use it from a
 * vi.mock factory:
 *
 *   vi.mock('maplibre-gl', async () => (await import('$components/__tests__/maplibre-mock')).maplibreMock());
 *
 * `mapState` records what the page did with the map: the handlers it registered,
 * the markers it built, and the data handed to each source. Call `resetMapState()`
 * in beforeEach, and `loadMockMap()` to fire 'load' once the map exists.
 */
export const mapState = {
	handlers: {} as Record<string, ((event?: unknown) => void)[]>,
	markers: [] as { element: HTMLElement; draggable: boolean; lngLat: [number, number] }[],
	sources: {} as Record<string, { features?: unknown[] }>
};

export function resetMapState() {
	for (const key of Object.keys(mapState.handlers)) delete mapState.handlers[key];
	for (const key of Object.keys(mapState.sources)) delete mapState.sources[key];
	mapState.markers.length = 0;
}

export function fireMapEvent(event: string, payload?: unknown) {
	for (const handler of mapState.handlers[event] ?? []) handler(payload);
}

/** Waits for the map to be built, then fires 'load' so it draws. */
export async function loadMockMap() {
	await vi.waitFor(() => {
		if (!mapState.handlers['load']) throw new Error('map not initialized yet');
	});
	fireMapEvent('load');
}

/** Location pins: markers that are not a draft pin, handle, or viewer dot. */
export function mockPins() {
	return mapState.markers.filter(
		(m) => !m.element.dataset.testid && m.element.className !== 'map-view-user-dot'
	);
}

export function maplibreMock() {
	// Constructor mocks use function expressions because arrow functions cannot
	// be called with `new`.
	const Map = vi.fn(function () {
		return {
			on: vi.fn((event: string, handler: () => void) => {
				(mapState.handlers[event] ??= []).push(handler);
			}),
			off: vi.fn(),
			once: vi.fn(),
			remove: vi.fn(),
			setStyle: vi.fn(),
			fitBounds: vi.fn(),
			flyTo: vi.fn(),
			easeTo: vi.fn(),
			getZoom: vi.fn(() => 12),
			addControl: vi.fn(),
			addSource: vi.fn((id: string, spec: { data?: { features?: unknown[] } }) => {
				mapState.sources[id] = spec.data ?? {};
			}),
			removeSource: vi.fn(),
			addLayer: vi.fn(),
			removeLayer: vi.fn(),
			moveLayer: vi.fn(),
			getLayer: vi.fn(() => ({})),
			getSource: vi.fn((id: string) => ({
				setData: (data: { features?: unknown[] }) => {
					mapState.sources[id] = data;
				},
				getClusterExpansionZoom: vi.fn().mockResolvedValue(14)
			})),
			setPaintProperty: vi.fn(),
			setLayoutProperty: vi.fn(),
			setFeatureState: vi.fn(),
			querySourceFeatures: vi.fn((id: string) => mapState.sources[id]?.features ?? []),
			queryRenderedFeatures: vi.fn(() => []),
			getCanvas: vi.fn(() => ({ style: {} })),
			getBounds: vi.fn(() => ({
				getWest: () => -75.3,
				getSouth: () => 39.9,
				getEast: () => -75.1,
				getNorth: () => 40.1
			}))
		};
	});

	const Marker = vi.fn(function (options: { element: HTMLElement; draggable?: boolean }) {
		const record = {
			element: options.element,
			draggable: options.draggable ?? false,
			lngLat: [0, 0] as [number, number]
		};
		mapState.markers.push(record);
		const instance = {
			setLngLat: (c: [number, number]) => {
				record.lngLat = c;
				return instance;
			},
			addTo: () => instance,
			remove: vi.fn(),
			on: () => instance,
			getLngLat: () => ({ lng: record.lngLat[0], lat: record.lngLat[1] })
		};
		return instance;
	});

	const Popup = vi.fn(function () {
		const instance = {
			setLngLat: () => instance,
			setDOMContent: () => instance,
			setText: () => instance,
			addTo: () => instance,
			on: () => instance,
			remove: () => instance
		};
		return instance;
	});

	const LngLatBounds = vi.fn(function () {
		const instance = { extend: () => instance };
		return instance;
	});

	const GeolocateControl = vi.fn(function () {
		return {};
	});

	// Named exports and the default namespace both carry the constructors because
	// the CJS interop can hand the component either shape.
	const namespace = { Map, Marker, Popup, LngLatBounds, GeolocateControl };
	return { ...namespace, default: namespace };
}
