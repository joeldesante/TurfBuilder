import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import LayeredMap from './LayeredMap.svelte';

const layers = [
	{ id: 'turfs', label: 'Turfs', visible: true },
	{ id: 'locations', label: 'Locations', visible: true }
];

test('renders the map container', async () => {
	const { getByTestId } = render(LayeredMap, { props: { layers } });

	await expect.element(getByTestId('layered-map')).toBeInTheDocument();
});

test('reports the number of layers in the scaffold placeholder', async () => {
	const { getByText } = render(LayeredMap, { props: { layers } });

	await expect.element(getByText(/2 layers/)).toBeVisible();
});

test('renders with no layers', async () => {
	const { getByText } = render(LayeredMap, { props: { layers: [] } });

	await expect.element(getByText(/0 layers/)).toBeVisible();
});
