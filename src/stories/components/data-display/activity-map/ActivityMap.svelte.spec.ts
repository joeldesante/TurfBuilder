import { test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import ActivityMap from './ActivityMap.svelte';

test('shows the zoom hint over the map', async () => {
	render(ActivityMap, { points: [], class: 'h-64' });
	await expect.element(page.getByText('Zoom in to see each business')).toBeVisible();
});
