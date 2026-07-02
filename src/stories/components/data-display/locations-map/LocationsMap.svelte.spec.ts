import { render } from 'vitest-browser-svelte';
import { expect, test, vi, beforeEach } from 'vitest';

const { mapHandlers, markerInstances } = vi.hoisted(() => ({
	mapHandlers: {} as Record<string, ((event?: unknown) => void)[]>,
	markerInstances: [] as { element: HTMLElement }[]
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
			once: vi.fn(),
			remove: vi.fn(),
			setStyle: vi.fn(),
			fitBounds: vi.fn(),
			flyTo: vi.fn()
		};
	});

	const Marker = vi.fn(function (options: { element: HTMLElement }) {
		markerInstances.push({ element: options.element });
		const instance = {
			setLngLat: () => instance,
			setPopup: () => instance,
			addTo: () => instance,
			remove: vi.fn(),
			getPopup: () => ({ isOpen: () => false }),
			togglePopup: vi.fn()
		};
		return instance;
	});

	const Popup = vi.fn(function () {
		const instance = { setDOMContent: () => instance };
		return instance;
	});

	// Named exports and the default namespace both carry the constructors because
	// the CJS interop can hand the component either shape.
	const namespace = { Map, Marker, Popup, LngLatBounds };
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
	vi.clearAllMocks();
});

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

	await vi.waitFor(() => {
		if (!mapHandlers['load']) throw new Error('map not initialized yet');
	});
	fireMapEvent('load');

	await vi.waitFor(() => {
		expect(markerInstances.length).toBe(2);
	});
	markerInstances[1].element.click();

	await vi.waitFor(() => {
		expect(props.selectedLocationId).toBe('loc-2');
	});
});
