import { render } from 'vitest-browser-svelte';
import { expect, test, vi, beforeEach } from 'vitest';

const { mapHandlers, markerInstances, mapInstance } = vi.hoisted(() => ({
	mapHandlers: {} as Record<string, ((event?: unknown) => void)[]>,
	markerInstances: [] as { element: HTMLElement; removed: boolean }[],
	mapInstance: {
		flyTo: vi.fn(),
		remove: vi.fn(),
		addControl: vi.fn(),
		getCanvas: vi.fn(() => ({ style: {} as CSSStyleDeclaration })),
		getLayer: vi.fn(() => ({})),
		getSource: vi.fn(() => ({ setData: vi.fn() })),
		addSource: vi.fn(),
		addLayer: vi.fn(),
		removeLayer: vi.fn(),
		removeSource: vi.fn()
	}
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
			setStyle: vi.fn(),
			fitBounds: vi.fn(),
			...mapInstance
		};
	});

	const Marker = vi.fn(function (options: { element: HTMLElement }) {
		const record = { element: options.element, removed: false };
		markerInstances.push(record);
		const instance = {
			setLngLat: () => instance,
			setPopup: () => instance,
			addTo: () => instance,
			on: () => instance,
			getLngLat: () => ({ lng: 0, lat: 0 }),
			getPopup: () => ({ isOpen: () => false }),
			togglePopup: vi.fn(),
			remove: vi.fn(() => {
				record.removed = true;
			})
		};
		return instance;
	});

	const Popup = vi.fn(function () {
		const instance = { setDOMContent: () => instance };
		return instance;
	});

	const GeolocateControl = vi.fn(function () {
		return {};
	});

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
import TurfMapPage from './TurfMapPage.svelte';

const center = { lat: 39.9526, lng: -75.1652 };

const locations = [
	{
		id: 'tl-1',
		location_name: 'Rosa Deli',
		visited: false,
		contact_made: null,
		latitude: 39.9526,
		longitude: -75.1652,
		street: '123 Main St',
		locality: 'Philadelphia',
		postcode: '19104',
		region: 'PA',
		country: 'US'
	},
	{
		id: 'tl-2',
		location_name: 'Corner Barbershop',
		visited: true,
		contact_made: true,
		latitude: 39.9541,
		longitude: -75.1601,
		street: '87 Market St',
		locality: 'Philadelphia',
		postcode: '19104',
		region: 'PA',
		country: 'US'
	}
];

const props = { orgSlug: 'acme', turfId: 'turf-1', locations, center };

function fireMapEvent(event: string) {
	for (const handler of mapHandlers[event] ?? []) handler();
}

/** Waits for the map to be constructed, then fires 'load' to draw markers. */
async function loadMap() {
	await vi.waitFor(() => {
		if (!mapHandlers['load']) throw new Error('map not initialized yet');
	});
	fireMapEvent('load');
	await vi.waitFor(() => {
		if (markerInstances.length === 0) throw new Error('markers not drawn yet');
	});
}

beforeEach(() => {
	for (const key of Object.keys(mapHandlers)) delete mapHandlers[key];
	markerInstances.length = 0;
	vi.clearAllMocks();
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
});

test('renders the map container', async () => {
	const { getByTestId } = render(TurfMapPage, { props });

	await expect.element(getByTestId('locations-map')).toBeInTheDocument();
});

test('links back to the organization home', async () => {
	const { getByRole } = render(TurfMapPage, { props });

	await expect
		.element(getByRole('link', { name: 'Back to home' }))
		.toHaveAttribute('href', '/o/acme');
});

test('creates a marker for each location once the map has loaded', async () => {
	render(TurfMapPage, { props });
	await loadMap();

	expect(maplibregl.Marker).toHaveBeenCalledTimes(2);
});

test('opens the detail panel when a marker is clicked', async () => {
	const { getByRole } = render(TurfMapPage, { props });
	await loadMap();

	markerInstances[0].element.click();

	await expect.element(getByRole('heading', { name: 'Rosa Deli' })).toBeVisible();
});

test('shows the street address of the selected location', async () => {
	const { getByText } = render(TurfMapPage, { props });
	await loadMap();

	markerInstances[0].element.click();

	await expect.element(getByText('123 Main St')).toBeVisible();
});

test('links the selected location to its survey screen', async () => {
	const { getByRole } = render(TurfMapPage, { props });
	await loadMap();

	markerInstances[1].element.click();

	await expect
		.element(getByRole('link', { name: 'Open Location' }))
		.toHaveAttribute('href', '/o/acme/map/turf-1/location/tl-2');
});

test('badges an unvisited location as Unvisited', async () => {
	const { getByText } = render(TurfMapPage, { props });
	await loadMap();

	markerInstances[0].element.click();

	await expect.element(getByText('Unvisited')).toBeVisible();
});

test('badges a visited location with contact as Contacted', async () => {
	const { getByText } = render(TurfMapPage, { props });
	await loadMap();

	markerInstances[1].element.click();

	await expect.element(getByText('Contacted')).toBeVisible();
});

test('badges a visited location without contact as No Contact', async () => {
	const noContact = [{ ...locations[1], contact_made: false }];
	const { getByText } = render(TurfMapPage, { props: { ...props, locations: noContact } });
	await loadMap();

	markerInstances[0].element.click();

	await expect.element(getByText('No Contact')).toBeVisible();
});

test('closes the detail panel', async () => {
	const { getByRole } = render(TurfMapPage, { props });
	await loadMap();

	markerInstances[0].element.click();
	await expect.element(getByRole('heading', { name: 'Rosa Deli' })).toBeVisible();

	await getByRole('button', { name: 'close' }).click();

	await expect.element(getByRole('heading', { name: 'Rosa Deli' })).not.toBeInTheDocument();
});

// A turf a volunteer is about to add the first location to must still render.
test('renders an empty turf without markers', async () => {
	const { getByTestId } = render(TurfMapPage, { props: { ...props, locations: [] } });

	await expect.element(getByTestId('locations-map')).toBeInTheDocument();
	expect(maplibregl.Marker).not.toHaveBeenCalled();
});

test('centres an empty turf on the turf centroid rather than fitting bounds', async () => {
	render(TurfMapPage, { props: { ...props, locations: [] } });

	await vi.waitFor(() => {
		expect(maplibregl.Map).toHaveBeenCalled();
	});
	const options = vi.mocked(maplibregl.Map).mock.calls[0][0] as Record<string, unknown>;
	expect(options.center).toEqual([center.lng, center.lat]);
	expect(options.bounds).toBeUndefined();
});

test('offers to find the user location', async () => {
	const { getByRole } = render(TurfMapPage, { props });

	await expect.element(getByRole('button', { name: 'Find my location' })).toBeVisible();
});

test('flies to the user position while tracking', async () => {
	const watchPosition = vi.fn((success: PositionCallback) => {
		success({ coords: { longitude: -75.2, latitude: 39.9 } } as GeolocationPosition);
		return 1;
	});
	vi.stubGlobal('navigator', { ...navigator, geolocation: { watchPosition, clearWatch: vi.fn() } });

	const { getByRole } = render(TurfMapPage, { props });
	await loadMap();

	await getByRole('button', { name: 'Find my location' }).click();

	await expect.element(getByRole('button', { name: 'Stop tracking location' })).toBeVisible();
	expect(mapInstance.flyTo).toHaveBeenCalledWith(
		expect.objectContaining({ center: [-75.2, 39.9] })
	);
});
