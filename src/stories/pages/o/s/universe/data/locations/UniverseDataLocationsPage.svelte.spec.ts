import { render } from 'vitest-browser-svelte';
import { expect, test, vi, beforeEach } from 'vitest';

const { mapHandlers, mapApi } = vi.hoisted(() => ({
	mapHandlers: {} as Record<string, ((event?: unknown) => void)[]>,
	mapApi: {
		getCanvas: vi.fn(() => ({ style: {} as CSSStyleDeclaration })),
		getLayer: vi.fn(() => ({})),
		getSource: vi.fn(() => ({ setData: vi.fn() })),
		addSource: vi.fn(),
		addLayer: vi.fn(),
		removeLayer: vi.fn(),
		removeSource: vi.fn(),
		addControl: vi.fn(),
		flyTo: vi.fn()
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
			remove: vi.fn(),
			setStyle: vi.fn(),
			fitBounds: vi.fn(),
			...mapApi
		};
	});

	const Marker = vi.fn(function () {
		const instance = {
			setLngLat: () => instance,
			setPopup: () => instance,
			addTo: () => instance,
			on: () => instance,
			getLngLat: () => ({ lng: 0, lat: 0 }),
			getPopup: () => ({ isOpen: () => false }),
			togglePopup: vi.fn(),
			remove: vi.fn()
		};
		return instance;
	});

	const Popup = vi.fn(function () {
		const instance = { setDOMContent: () => instance };
		return instance;
	});

	const namespace = { Map, Marker, Popup, LngLatBounds };
	return { ...namespace, default: namespace };
});

vi.mock('$lib/map-style', () => ({ getMapStyle: vi.fn().mockResolvedValue({}) }));
vi.mock('$lib/theme.svelte', () => ({
	themeStore: { theme: 'light', setTheme: vi.fn(), init: vi.fn() }
}));

import UniverseDataLocationsPage from './UniverseDataLocationsPage.svelte';

const locations = [
	{
		id: 'v-1',
		entity_id: 'e-1',
		name: 'Rosa Deli',
		address_line_1: '123 Main St',
		address_line_2: null,
		city: 'Philadelphia',
		state_or_region: 'PA',
		postal_code: '19104',
		country_code: 'US',
		latitude: 39.9526,
		longitude: -75.1652,
		photo_keys: [],
		suggestion_status: null
	},
	{
		id: 'v-2',
		entity_id: 'e-2',
		name: 'Corner Barbershop',
		address_line_1: '87 Market St',
		address_line_2: null,
		city: 'Philadelphia',
		state_or_region: 'PA',
		postal_code: '19104',
		country_code: 'US',
		latitude: 39.9541,
		longitude: -75.1601,
		photo_keys: [],
		suggestion_status: null
	}
];

const base = { orgSlug: 'acme', totalCount: 2, locations };

beforeEach(() => {
	for (const key of Object.keys(mapHandlers)) delete mapHandlers[key];
	vi.clearAllMocks();
});

/** Fires the map 'load' event, which is what arms pin-drop mode. */
async function armPinDrop() {
	await vi.waitFor(() => {
		if (!mapHandlers['load']) throw new Error('map not initialized yet');
	});
	for (const handler of mapHandlers['load']) handler();
	await vi.waitFor(() => {
		if (!mapHandlers['click']) throw new Error('pin drop not armed yet');
	});
}

test('lists each location with its address', async () => {
	const { getByText } = render(UniverseDataLocationsPage, { props: base });

	await expect.element(getByText('Rosa Deli')).toBeVisible();
	await expect.element(getByText('Corner Barbershop')).toBeVisible();
	await expect.element(getByText('Philadelphia, PA, 19104').first()).toBeVisible();
});

test('shows the empty state when there are no locations', async () => {
	const { getByText } = render(UniverseDataLocationsPage, {
		props: { ...base, locations: [], totalCount: 0 }
	});

	await expect.element(getByText('No location records found.')).toBeVisible();
});

test('notes when the list is truncated', async () => {
	const { getByText } = render(UniverseDataLocationsPage, {
		props: { ...base, totalCount: 4820 }
	});

	await expect.element(getByText(/Showing 2 of 4,820 records/)).toBeVisible();
});

test('flags a tentative location', async () => {
	const withTentative = [{ ...locations[0], suggestion_status: 'tentative' as const }];
	const { getByText } = render(UniverseDataLocationsPage, {
		props: { ...base, locations: withTentative }
	});

	await expect.element(getByText('Tentative')).toBeVisible();
});

test('offers the import menu', async () => {
	const { getByRole } = render(UniverseDataLocationsPage, { props: base });

	await expect.element(getByRole('button', { name: /Import/ }).first()).toBeVisible();
});

test('hides the add button without location.create', async () => {
	const { getByRole } = render(UniverseDataLocationsPage, { props: base });

	await expect.element(getByRole('button', { name: 'Add location' })).not.toBeInTheDocument();
});

test('hides row delete buttons without location.delete', async () => {
	const { getByRole } = render(UniverseDataLocationsPage, { props: base });

	await expect.element(getByRole('button', { name: 'Delete Rosa Deli' })).not.toBeInTheDocument();
});

test('shows a delete button per row with location.delete', async () => {
	const { getByRole } = render(UniverseDataLocationsPage, {
		props: { ...base, canDelete: true }
	});

	await expect.element(getByRole('button', { name: 'Delete Rosa Deli' })).toBeVisible();
});

test('asks for confirmation before deleting', async () => {
	const onDelete = vi.fn().mockResolvedValue(undefined);
	const { getByRole, getByText } = render(UniverseDataLocationsPage, {
		props: { ...base, canDelete: true, onDelete }
	});

	await getByRole('button', { name: 'Delete Rosa Deli' }).click();

	await expect.element(getByText('Delete this location?')).toBeVisible();
	expect(onDelete).not.toHaveBeenCalled();
});

test('deletes by entity id once confirmed', async () => {
	const onDelete = vi.fn().mockResolvedValue(undefined);
	const { getByRole } = render(UniverseDataLocationsPage, {
		props: { ...base, canDelete: true, onDelete }
	});

	await getByRole('button', { name: 'Delete Rosa Deli' }).click();
	await getByRole('button', { name: 'Delete', exact: true }).click();

	await vi.waitFor(() => {
		expect(onDelete).toHaveBeenCalledWith('e-1');
	});
});

// Deleting is soft, and the copy has to say so or organizers will assume the
// canvassing history went with it.
test('explains that history is retained', async () => {
	const { getByRole, getByText } = render(UniverseDataLocationsPage, {
		props: { ...base, canDelete: true }
	});

	await getByRole('button', { name: 'Delete Rosa Deli' }).click();

	await expect.element(getByText(/version history and any canvassing responses/)).toBeVisible();
});

test('keeps the dialog open and shows the error when deleting fails', async () => {
	const onDelete = vi.fn().mockRejectedValue(new Error('Forbidden.'));
	const { getByRole } = render(UniverseDataLocationsPage, {
		props: { ...base, canDelete: true, onDelete }
	});

	await getByRole('button', { name: 'Delete Rosa Deli' }).click();
	await getByRole('button', { name: 'Delete', exact: true }).click();

	await expect.element(getByRole('alert')).toHaveTextContent('Forbidden.');
});

test('switches to the map view', async () => {
	const { getByRole, getByTestId } = render(UniverseDataLocationsPage, { props: base });

	await getByRole('button', { name: 'Map' }).click();

	await expect.element(getByTestId('locations-map')).toBeInTheDocument();
});

test('opens the map in placing mode from the add button', async () => {
	const { getByRole, getByText } = render(UniverseDataLocationsPage, {
		props: { ...base, canCreate: true }
	});

	await getByRole('button', { name: 'Add location' }).click();

	await expect.element(getByText('Click the map to place the new location.')).toBeVisible();
});

test('shows the form once a pin is dropped', async () => {
	const { getByRole, getByLabelText } = render(UniverseDataLocationsPage, {
		props: { ...base, canCreate: true }
	});

	await getByRole('button', { name: 'Add location' }).click();
	await armPinDrop();
	mapHandlers['click'][0]({ lngLat: { lat: 40.1, lng: -75.9 } });

	await expect.element(getByLabelText('Business name')).toBeVisible();
});

test('creates a location from the dropped pin', async () => {
	const onCreate = vi.fn().mockResolvedValue(undefined);
	const { getByRole, getByLabelText } = render(UniverseDataLocationsPage, {
		props: { ...base, canCreate: true, onCreate }
	});

	await getByRole('button', { name: 'Add location' }).click();
	await armPinDrop();
	mapHandlers['click'][0]({ lngLat: { lat: 40.1, lng: -75.9 } });

	await getByLabelText('Business name').fill('New Bodega');
	await getByRole('button', { name: 'Add location', exact: true }).nth(1).click();

	await vi.waitFor(() => {
		expect(onCreate).toHaveBeenCalledTimes(1);
	});
	expect(onCreate.mock.calls[0][0]).toMatchObject({
		name: 'New Bodega',
		latitude: 40.1,
		longitude: -75.9
	});
});

test('cancels placing', async () => {
	const { getByRole, getByText } = render(UniverseDataLocationsPage, {
		props: { ...base, canCreate: true }
	});

	await getByRole('button', { name: 'Add location' }).click();
	await getByRole('button', { name: 'Cancel' }).click();

	await expect
		.element(getByText('Click the map to place the new location.'))
		.not.toBeInTheDocument();
});
