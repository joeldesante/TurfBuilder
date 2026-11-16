import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { expect, test, vi } from 'vitest';
import MapLayerToggles from './MapLayerToggles.svelte';

const few = [
	{ id: 'a', name: 'Wards', color: '#2f6fed' },
	{ id: 'b', name: 'Parks', color: '#2a9d4b' }
];
const many = Array.from({ length: 200 }, (_, i) => ({
	id: `l${i}`,
	name: i % 2 ? `Precinct ${i}` : `Ward ${i}`,
	color: '#2f6fed'
}));

/** Props whose on/off state lives in a $state record, as MapView keeps it. */
function setup(layers = few, initiallyOff: string[] = []) {
	const off = $state<Record<string, boolean>>(Object.fromEntries(initiallyOff.map((id) => [id, true])));
	const onToggle = vi.fn((ids: string[], on: boolean) => {
		for (const id of ids) off[id] = !on;
	});
	render(MapLayerToggles, { props: { layers, isOn: (l) => !off[l.id], onToggle } });
	return { onToggle };
}

test('starts as a closed button', async () => {
	setup();

	await expect.element(page.getByRole('button', { name: 'Layers' })).toHaveAttribute('aria-expanded', 'false');
	await expect.element(page.getByRole('checkbox', { name: 'Wards' })).not.toBeInTheDocument();
});

test('opens to a list showing which layers are on', async () => {
	setup(few, ['b']);

	await page.getByRole('button', { name: 'Layers' }).click();

	await expect.element(page.getByRole('checkbox', { name: 'Wards' })).toBeChecked();
	await expect.element(page.getByRole('checkbox', { name: 'Parks' })).not.toBeChecked();
});

test('turns a layer off and on again', async () => {
	const { onToggle } = setup();
	await page.getByRole('button', { name: 'Layers' }).click();

	await page.getByRole('checkbox', { name: 'Wards' }).click();
	await expect.element(page.getByRole('checkbox', { name: 'Wards' })).not.toBeChecked();
	await page.getByRole('checkbox', { name: 'Wards' }).click();

	expect(onToggle.mock.calls).toEqual([
		[['a'], false],
		[['a'], true]
	]);
});

test('hides all, then shows all', async () => {
	const { onToggle } = setup();
	await page.getByRole('button', { name: 'Layers' }).click();

	await page.getByRole('button', { name: 'Hide all' }).click();
	await page.getByRole('button', { name: 'Show all' }).click();

	expect(onToggle.mock.calls).toEqual([
		[['a', 'b'], false],
		[['a', 'b'], true]
	]);
});

test('has no search box for a short list', async () => {
	setup();
	await page.getByRole('button', { name: 'Layers' }).click();

	await expect.element(page.getByRole('searchbox', { name: 'Search layers' })).not.toBeInTheDocument();
});

test('searches a long list, and hide all acts only on the matches', async () => {
	const { onToggle } = setup(many);
	await page.getByRole('button', { name: 'Layers' }).click();

	await page.getByRole('searchbox', { name: 'Search layers' }).fill('precinct 19');
	await expect.element(page.getByRole('checkbox', { name: 'Precinct 19', exact: true })).toBeInTheDocument();
	await expect.element(page.getByRole('checkbox', { name: 'Ward 2', exact: true })).not.toBeInTheDocument();

	await page.getByRole('button', { name: 'Hide all' }).click();

	// Precinct 19 and 191-199 (odd ones only), not every layer.
	const [ids, on] = onToggle.mock.calls[0];
	expect(on).toBe(false);
	expect(ids).toEqual(['l19', 'l191', 'l193', 'l195', 'l197', 'l199']);
});

test('closes on Escape and returns focus to the button', async () => {
	setup();
	await page.getByRole('button', { name: 'Layers' }).click();
	const row = page.getByRole('checkbox', { name: 'Wards' });
	(row.element() as HTMLElement).focus();

	(row.element() as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

	await expect.element(page.getByRole('checkbox', { name: 'Wards' })).not.toBeInTheDocument();
	await expect.element(page.getByRole('button', { name: 'Layers' })).toHaveFocus();
});

test('titles the open list Layers', async () => {
	setup();
	await page.getByRole('button', { name: 'Layers' }).click();

	await expect.element(page.getByRole('heading', { name: 'Layers' })).toBeVisible();
	await expect.element(page.getByRole('group', { name: 'Layers' })).toBeVisible();
});

test('shows a spinner on a layer that is still loading', async () => {
	render(MapLayerToggles, {
		props: { layers: few, isOn: () => true, isLoading: (l) => l.id === 'a', onToggle: vi.fn(), open: true }
	});

	await expect.element(page.getByRole('checkbox', { name: /Wards/ }).getByLabelText('Loading')).toBeInTheDocument();
	await expect.element(page.getByRole('checkbox', { name: /Parks/ }).getByLabelText('Loading')).not.toBeInTheDocument();
});
