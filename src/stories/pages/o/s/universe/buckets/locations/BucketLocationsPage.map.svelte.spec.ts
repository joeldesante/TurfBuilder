import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('maplibre-gl', async () =>
	(await import('$components/__tests__/maplibre-mock')).maplibreMock()
);
vi.mock('$lib/map-style', () => ({ getMapStyle: vi.fn().mockResolvedValue({}) }));
vi.mock('$lib/theme.svelte', () => ({
	themeStore: { theme: 'light', setTheme: vi.fn(), init: vi.fn() }
}));

import { fireMapEvent, loadMockMap, mapState, resetMapState } from '$components/__tests__/maplibre-mock';
import BucketLocationsPage from './BucketLocationsPage.svelte';

const markers = [
	{ id: '1', name: 'City Hall', address_line_1: '100 Main St', city: 'Springfield', latitude: 39.8, longitude: -89.6 },
	{ id: '2', name: null, address_line_1: '42 Oak Ave', city: 'Springfield', latitude: 39.81, longitude: -89.61 }
];

const props = {
	bucketName: 'Downtown District',
	enabled: true,
	locations: [],
	basePath: '/b/locations',
	view: 'map' as const,
	markers
};

beforeEach(() => {
	resetMapState();
	vi.clearAllMocks();
});

test('fills the screen with a map of the bucket points', async () => {
	render(BucketLocationsPage, { props });

	await expect.element(page.getByTestId('map-view')).toBeInTheDocument();
	await expect.element(page.getByRole('heading', { name: 'Locations' })).not.toBeInTheDocument();
	await loadMockMap();
	await vi.waitFor(() => expect(mapState.sources['mv-points']?.features).toHaveLength(2));
});

test('keeps the tabs on the map, with Map current, to get back to the list', async () => {
	render(BucketLocationsPage, { props });

	await expect.element(page.getByRole('link', { name: 'Map' })).toHaveAttribute('aria-current', 'page');
	await expect.element(page.getByRole('link', { name: 'List' })).toHaveAttribute('href', '/b/locations');
});

test('names the bucket and counts every located match, not just the ones on screen', async () => {
	render(BucketLocationsPage, { props: { ...props, mapTotal: 12000 } });

	await expect.element(page.getByText('Downtown District')).toBeInTheDocument();
	await expect.element(page.getByText('12,000 locations')).toBeInTheDocument();
});

test('opens on the bucket bounds and loads only what is on screen, with the zoom', async () => {
	const onViewportLoad = vi.fn().mockResolvedValue({
		points: [markers[0]],
		clusters: [{ id: '12:1:1', latitude: 39.9, longitude: -89.7, count: 500 }]
	});
	const bounds = { west: -90, south: 39, east: -89, north: 40 };
	render(BucketLocationsPage, { props: { ...props, markers: [], mapBounds: bounds, onViewportLoad } });

	await loadMockMap();

	expect(onViewportLoad).toHaveBeenCalledWith({ west: -75.3, south: 39.9, east: -75.1, north: 40.1 }, 12);
	await vi.waitFor(() => {
		expect(mapState.sources['mv-points']?.features).toHaveLength(1);
		expect(mapState.sources['mv-server-clusters']?.features).toHaveLength(1);
	});
});

test('drops an answer for an area the person has already moved away from', async () => {
	let answerFirst: (v: unknown) => void = () => {};
	const onViewportLoad = vi
		.fn()
		.mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)))
		.mockResolvedValueOnce({ points: [markers[1]], clusters: [] });
	render(BucketLocationsPage, { props: { ...props, markers: [], onViewportLoad } });

	await loadMockMap();
	fireMapEvent('moveend');
	await vi.waitFor(() => expect(mapState.sources['mv-points']?.features).toHaveLength(1));
	answerFirst({ points: markers, clusters: [] });

	await new Promise((r) => setTimeout(r, 50));
	expect(mapState.sources['mv-points']?.features).toHaveLength(1);
});

test('offers the layer list when the org has layers', async () => {
	render(BucketLocationsPage, {
		props: {
			...props,
			mapLayers: [
				{
					id: 'l1',
					name: 'Wards',
					color: '#2f6fed',
					label_field: null,
					position: 0,
					created_at: '2026-11-16T00:00:00Z',
					updated_at: '2026-11-16T00:00:00Z'
				}
			]
		}
	});

	await expect.element(page.getByRole('button', { name: 'Layers' })).toBeInTheDocument();
});
