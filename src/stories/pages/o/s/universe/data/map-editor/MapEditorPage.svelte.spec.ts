import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { toast } from 'svelte-sonner';

vi.mock('maplibre-gl', async () =>
	(await import('$components/__tests__/maplibre-mock')).maplibreMock()
);
vi.mock('$lib/map-style', () => ({ getMapStyle: vi.fn().mockResolvedValue({}) }));
vi.mock('$lib/theme.svelte', () => ({
	themeStore: { theme: 'light', setTheme: vi.fn(), init: vi.fn() }
}));

import { resetMapState } from '$components/__tests__/maplibre-mock';
import Toaster from '$components/feedback/toaster/Toaster.svelte';
import { ApiError } from '$lib/client/api';
import type { MapLayer } from '$lib/shared/types/map-layers';
import MapEditorPage from './MapEditorPage.svelte';

function layer(id: string, name: string, position: number): MapLayer {
	return {
		id,
		name,
		color: '#2f6fed',
		label_field: null,
		position,
		geojson: { type: 'FeatureCollection', features: [] },
		created_at: '2026-11-16T00:00:00Z',
		updated_at: '2026-11-16T00:00:00Z'
	};
}

const wards = layer('l1', 'Wards', 0);
const parks = layer('l2', 'Parks', 1);

function setup(overrides: Record<string, unknown> = {}) {
	const props = {
		layers: [wards, parks],
		dashboardHref: '/o/acme/s/',
		onCreate: vi.fn(),
		onUpdate: vi.fn().mockResolvedValue(wards),
		onDelete: vi.fn().mockResolvedValue(undefined),
		onReorder: vi.fn().mockResolvedValue(undefined),
		...overrides
	};
	render(Toaster);
	render(MapEditorPage, { props });
	return props;
}

beforeEach(() => {
	resetMapState();
	vi.clearAllMocks();
});

afterEach(() => {
	toast.dismiss();
});

test('lists the saved layers, top first', async () => {
	setup();

	await expect.element(page.getByRole('button', { name: 'Edit Wards' })).toBeInTheDocument();
	await expect.element(page.getByRole('button', { name: 'Move Wards up' })).toBeDisabled();
	await expect.element(page.getByRole('button', { name: 'Move Parks down' })).toBeDisabled();
});

test('saves the new order when a layer is moved', async () => {
	const props = setup();

	await page.getByRole('button', { name: 'Open sidebar' }).click();
	await page.getByRole('button', { name: 'Move Parks up' }).click();

	expect(props.onReorder).toHaveBeenCalledWith(['l2', 'l1']);
	await expect.element(page.getByRole('button', { name: 'Move Parks up' })).toBeDisabled();
});

test('puts the order back and says so when saving it fails', async () => {
	setup({ onReorder: vi.fn().mockRejectedValue(new ApiError('The list of layers changed.', 409)) });

	await page.getByRole('button', { name: 'Open sidebar' }).click();
	await page.getByRole('button', { name: 'Move Parks up' }).click();

	await expect.element(page.getByText('The list of layers changed.')).toBeVisible();
	await expect.element(page.getByRole('button', { name: 'Move Wards up' })).toBeDisabled();
});

test('deletes a layer once confirmed', async () => {
	const props = setup();

	await page.getByRole('button', { name: 'Open sidebar' }).click();
	await page.getByRole('button', { name: 'Delete Wards' }).click();
	await page.getByRole('button', { name: 'Delete', exact: true }).click();

	expect(props.onDelete).toHaveBeenCalledWith('l1');
	await expect.element(page.getByRole('button', { name: 'Edit Wards' })).not.toBeInTheDocument();
});

test('hides a layer without saving anything', async () => {
	const props = setup();

	await page.getByRole('button', { name: 'Open sidebar' }).click();
	await page.getByRole('button', { name: 'Hide Wards' }).click();

	await expect.element(page.getByRole('button', { name: 'Show Wards' })).toBeInTheDocument();
	expect(props.onUpdate).not.toHaveBeenCalled();
	expect(props.onReorder).not.toHaveBeenCalled();
});
