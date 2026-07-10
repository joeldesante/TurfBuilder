import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import OvertureImportPage from './OvertureImportPage.svelte';
import type { ImportProgress } from './OvertureImportPage.svelte';

vi.mock('maplibre-gl', () => {
	class Map {
		remove = vi.fn();
		on = vi.fn();
		setStyle = vi.fn();
		getCanvas = vi.fn().mockReturnValue({ addEventListener: vi.fn() });
	}
	return { default: { Map }, Map };
});

async function* neverCalled(): AsyncGenerator<ImportProgress> {
	yield { stage: 'done', result: { imported: 0, skipped: 0, errors: [] } };
}

test('renders the panel with instructions when nothing is selected', async () => {
	const { getByText } = render(OvertureImportPage, {
		props: { orgSlug: 'test-org', layers: [], onImport: neverCalled }
	});

	await expect.element(getByText(/click areas on the map to select them/i)).toBeVisible();
});

test('import button is disabled when nothing is selected', async () => {
	const { getByRole } = render(OvertureImportPage, {
		props: { orgSlug: 'test-org', layers: [], onImport: neverCalled }
	});

	await expect.element(getByRole('button', { name: /import businesses/i })).toBeDisabled();
});

test('shows a loading indicator while layers are pending', async () => {
	const pending = new Promise<never>(() => {});
	const { getByRole } = render(OvertureImportPage, {
		props: { orgSlug: 'test-org', layers: pending, onImport: neverCalled }
	});

	await expect.element(getByRole('status')).toBeVisible();
});

test('shows an error message when loading layers fails', async () => {
	const failed = Promise.reject(new Error('Failed to load map layers.'));
	failed.catch(() => {});
	const { getByRole } = render(OvertureImportPage, {
		props: { orgSlug: 'test-org', layers: failed, onImport: neverCalled }
	});

	await expect.element(getByRole('alert')).toHaveTextContent('Failed to load map layers.');
});

test('renders back link to locations page', async () => {
	const { getByRole } = render(OvertureImportPage, {
		props: { orgSlug: 'my-org', layers: [], onImport: neverCalled }
	});

	const link = getByRole('link', { name: /back to locations/i });
	await expect.element(link).toBeVisible();
	await expect.element(link).toHaveAttribute('href', '/o/my-org/s/universe/data/locations');
});
