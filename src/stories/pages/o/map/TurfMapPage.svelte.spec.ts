import { render } from 'vitest-browser-svelte';
import { expect, test, vi, beforeEach } from 'vitest';

vi.mock('maplibre-gl', async () =>
	(await import('$components/__tests__/maplibre-mock')).maplibreMock()
);

vi.mock('$lib/map-style', () => ({
	getMapStyle: vi.fn().mockResolvedValue({})
}));

vi.mock('$lib/theme.svelte', () => ({
	themeStore: { theme: 'light', setTheme: vi.fn(), init: vi.fn() }
}));

import maplibregl from 'maplibre-gl';
import {
	loadMockMap,
	mockPins,
	resetMapState
} from '$components/__tests__/maplibre-mock';
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

const props = { orgSlug: 'acme', orgId: 'o1', turfId: 'turf-1', locations, center };

/** Waits for the map to be constructed, then fires 'load' so the pins are drawn. */
async function loadMap() {
	await loadMockMap();
	await vi.waitFor(() => {
		if (mockPins().length === 0) throw new Error('pins not drawn yet');
	});
}

beforeEach(() => {
	resetMapState();
	vi.clearAllMocks();
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
});

test('renders the map container', async () => {
	const { getByTestId } = render(TurfMapPage, { props });

	await expect.element(getByTestId('map-view')).toBeInTheDocument();
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

	mockPins()[0].element.click();

	await expect.element(getByRole('heading', { name: 'Rosa Deli' })).toBeVisible();
});

test('shows the street address of the selected location', async () => {
	const { getByText } = render(TurfMapPage, { props });
	await loadMap();

	mockPins()[0].element.click();

	await expect.element(getByText('123 Main St')).toBeVisible();
});

test('links the selected location to its survey screen', async () => {
	const { getByRole } = render(TurfMapPage, { props });
	await loadMap();

	mockPins()[1].element.click();

	await expect
		.element(getByRole('link', { name: 'Open Location' }))
		.toHaveAttribute('href', '/o/acme/map/turf-1/location/tl-2');
});

test('badges an unvisited location as Unvisited', async () => {
	const { getByText } = render(TurfMapPage, { props });
	await loadMap();

	mockPins()[0].element.click();

	await expect.element(getByText('Unvisited')).toBeVisible();
});

test('badges a visited location with contact as Contacted', async () => {
	const { getByText } = render(TurfMapPage, { props });
	await loadMap();

	mockPins()[1].element.click();

	await expect.element(getByText('Contacted')).toBeVisible();
});

test('badges a visited location without contact as No Contact', async () => {
	const noContact = [{ ...locations[1], contact_made: false }];
	const { getByText } = render(TurfMapPage, { props: { ...props, locations: noContact } });
	await loadMap();

	mockPins()[0].element.click();

	await expect.element(getByText('No Contact')).toBeVisible();
});

test('closes the detail panel', async () => {
	const { getByRole } = render(TurfMapPage, { props });
	await loadMap();

	mockPins()[0].element.click();
	await expect.element(getByRole('heading', { name: 'Rosa Deli' })).toBeVisible();

	await getByRole('button', { name: 'close' }).click();

	await expect.element(getByRole('heading', { name: 'Rosa Deli' })).not.toBeInTheDocument();
});

// A turf a volunteer is about to add the first location to must still render.
test('renders an empty turf without markers', async () => {
	const { getByTestId } = render(TurfMapPage, { props: { ...props, locations: [] } });

	await expect.element(getByTestId('map-view')).toBeInTheDocument();
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
	const map = vi.mocked(maplibregl.Map).mock.results[0].value as { flyTo: () => void };
	expect(map.flyTo).toHaveBeenCalledWith(
		expect.objectContaining({ center: [-75.2, 39.9] })
	);
});
