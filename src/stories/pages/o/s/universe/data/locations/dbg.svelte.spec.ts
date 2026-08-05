import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';

vi.mock('maplibre-gl', () => {
	const LngLatBounds = vi.fn(function () { const i = { extend: () => i }; return i; });
	const Map = vi.fn(function () {
		return { on: vi.fn(), off: vi.fn(), once: vi.fn(), remove: vi.fn(), setStyle: vi.fn(), fitBounds: vi.fn(), getCanvas: () => ({ style: {} }), addControl: vi.fn() };
	});
	const Marker = vi.fn(function () { const i = { setLngLat: () => i, setPopup: () => i, addTo: () => i, on: () => i, remove: vi.fn() }; return i; });
	const Popup = vi.fn(function () { const i = { setDOMContent: () => i }; return i; });
	const ns = { Map, Marker, Popup, LngLatBounds };
	return { ...ns, default: ns };
});
vi.mock('$lib/map-style', () => ({ getMapStyle: vi.fn().mockResolvedValue({}) }));
vi.mock('$lib/theme.svelte', () => ({ themeStore: { theme: 'light', setTheme: vi.fn(), init: vi.fn() } }));

import Page from './UniverseDataLocationsPage.svelte';

test('which locators match', async () => {
	const { getByText } = render(Page, { props: { orgSlug: 'acme', totalCount: 4820, page: 3, pageSize: 2, locations: [] } });
	await new Promise((r) => setTimeout(r, 300));
	const probes: [string, unknown][] = [
		['/Showing 5/', getByText(/Showing 5/)],
		['/records\\. Use/', getByText(/records\. Use/)],
		['/of 4,820/', getByText(/of 4,820/)],
		['/5–6/', getByText(/5–6/)],
		['/Showing 5–6 of 4,820 records/', getByText(/Showing 5–6 of 4,820 records/)]
	];
	const results = probes.map(([label, loc]) => `${label}=${(loc as { elements: () => unknown[] }).elements().length}`);
	expect(results.join(' | ')).toBe('FORCE');
});
