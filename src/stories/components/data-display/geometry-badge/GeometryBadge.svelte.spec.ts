import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import GeometryBadge from './GeometryBadge.svelte';

describe('GeometryBadge', () => {
	it('names each kind of geometry', async () => {
		render(GeometryBadge, { props: { kind: 'polygon' } });
		await expect.element(page.getByText('Polygons')).toBeVisible();
	});

	it('says lines and points', async () => {
		const lines = render(GeometryBadge, { props: { kind: 'line' } });
		await expect.element(lines.getByText('Lines')).toBeVisible();
		const points = render(GeometryBadge, { props: { kind: 'point' } });
		await expect.element(points.getByText('Points')).toBeVisible();
	});

	it('shows a count with thousands separators', async () => {
		render(GeometryBadge, { props: { kind: 'point', count: 1204 } });
		await expect.element(page.getByText('Points (1,204)')).toBeVisible();
	});
});
