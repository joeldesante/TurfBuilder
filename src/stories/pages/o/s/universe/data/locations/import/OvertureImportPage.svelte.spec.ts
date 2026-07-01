import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import OvertureImportPage from './OvertureImportPage.svelte';
import type { ImportProgress } from './OvertureImportPage.svelte';

vi.mock('maplibre-gl', () => ({
	default: {
		Map: vi.fn().mockImplementation(() => ({
			remove: vi.fn(),
			on: vi.fn(),
			setStyle: vi.fn(),
			getCanvas: vi.fn().mockReturnValue({ addEventListener: vi.fn() })
		}))
	}
}));

vi.mock('@geoman-io/maplibre-geoman-free', () => ({
	Geoman: vi.fn().mockImplementation(() => ({
		features: { getAll: vi.fn().mockReturnValue({ features: [] }) }
	}))
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
