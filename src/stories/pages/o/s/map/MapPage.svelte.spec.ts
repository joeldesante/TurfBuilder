import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import MapPage from './MapPage.svelte';
import type { MapLayer } from '$components/data-display/layered-map/LayeredMap.svelte';

test('renders the page header and action links', async () => {
	const { getByRole } = render(MapPage, { props: { layers: [] } });

	await expect.element(getByRole('heading', { name: 'Map' })).toBeVisible();
	await expect.element(getByRole('link', { name: 'Browse Layer Library' })).toBeVisible();
	await expect.element(getByRole('link', { name: 'Create Custom Layer' })).toBeVisible();
});

test('action links point to the provided hrefs', async () => {
	const { getByRole } = render(MapPage, {
		props: { layers: [], browseHref: '/x/browse', createHref: '/x/create' }
	});

	await expect
		.element(getByRole('link', { name: 'Browse Layer Library' }))
		.toHaveAttribute('href', '/x/browse');
	await expect
		.element(getByRole('link', { name: 'Create Custom Layer' }))
		.toHaveAttribute('href', '/x/create');
});

test('shows a loading indicator while layers are pending', async () => {
	const pending = new Promise<MapLayer[]>(() => {});
	const { getByRole } = render(MapPage, { props: { layers: pending } });

	await expect.element(getByRole('status')).toBeVisible();
});

test('shows an error message when loading layers fails', async () => {
	const failed = Promise.reject(new Error('Failed to load map layers.'));
	failed.catch(() => {});
	const { getByRole } = render(MapPage, { props: { layers: failed } });

	await expect.element(getByRole('alert')).toHaveTextContent('Failed to load map layers.');
});
