import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import OvertureImportPage from './OvertureImportPage.svelte';
import type { ImportProgress } from './OvertureImportPage.svelte';

// Constructor mocks use function expressions: the component calls them with
// `new`, which an arrow function cannot handle. Exported both as named exports
// and as the default, like the other map specs, so the default import
// resolves whichever way Vite interops maplibre-gl.
vi.mock('maplibre-gl', () => {
	const Map = vi.fn(function () {
		return {
			remove: vi.fn(),
			on: vi.fn(),
			setStyle: vi.fn(),
			getCanvas: vi.fn().mockReturnValue({ addEventListener: vi.fn() })
		};
	});
	const namespace = { Map };
	return { ...namespace, default: namespace };
});

vi.mock('@geoman-io/maplibre-geoman-free', () => ({
	Geoman: vi.fn(function () {
		return { features: { getAll: vi.fn().mockReturnValue({ features: [] }) } };
	})
}));

vi.mock('$lib/map-style', () => ({
	getMapStyle: vi.fn().mockResolvedValue({})
}));

vi.mock('$lib/theme.svelte', () => ({
	themeStore: { theme: 'light' }
}));

async function* neverCalled(): AsyncGenerator<ImportProgress> {
	yield { stage: 'done', result: { imported: 0, skipped: 0, errors: [] } };
}

test('renders the panel with instructions when no polygon is drawn', async () => {
	const { getByText } = render(OvertureImportPage, {
		props: { orgSlug: 'test-org', onImport: neverCalled }
	});

	await expect
		.element(getByText(/use the polygon tool/i))
		.toBeVisible();
});

test('import button is disabled when no polygon is drawn', async () => {
	const { getByRole } = render(OvertureImportPage, {
		props: { orgSlug: 'test-org', onImport: neverCalled }
	});

	await expect
		.element(getByRole('button', { name: /import businesses/i }))
		.toBeDisabled();
});

test('renders back link to locations page', async () => {
	const { getByRole } = render(OvertureImportPage, {
		props: { orgSlug: 'my-org', onImport: neverCalled }
	});

	const link = getByRole('link', { name: /back to locations/i });
	await expect.element(link).toBeVisible();
	await expect.element(link).toHaveAttribute('href', '/o/my-org/s/universe/data/locations');
});
