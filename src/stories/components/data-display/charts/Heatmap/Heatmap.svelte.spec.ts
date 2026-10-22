import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import { describe, expect, test } from 'vitest';
import Heatmap from './Heatmap.svelte';
import { cohortCells, cohortCols, cohortRows } from '../fixtures';

const props = {
	title: 'Retention',
	cells: cohortCells,
	rows: cohortRows,
	cols: cohortCols,
	colLabel: (c: string) => `Week ${c}`,
	format: 'percent' as const,
	max: 1
};

describe('Heatmap', () => {
	test('draws a cell for every value, including no-data cells', async () => {
		const { container } = render(Heatmap, { props });

		expect(container.querySelectorAll('svg[aria-label^="Retention"] rect')).toHaveLength(cohortCells.length);
		const empty = [...container.querySelectorAll('svg[aria-label^="Retention"] rect')].filter((r) => r.getAttribute('fill') === 'var(--chart-seq-empty)');
		expect(empty.length).toBe(cohortCells.filter((c) => c.value === null).length);
	});

	test('colors by step of the sequential ramp', async () => {
		const { container } = render(Heatmap, { props });

		const full = [...container.querySelectorAll('svg[aria-label^="Retention"] rect')].filter((r) => r.getAttribute('fill') === 'var(--chart-seq-700)');
		expect(full.length).toBe(cohortRows.length);
	});

	test('labels each cell with the ink made for its ramp step, so the top cell is readable', async () => {
		const { container } = render(Heatmap, { props: { ...props, cellLabels: true } });
		const svg = container.querySelector('svg[aria-label^="Retention"]')!;

		// The cell filled with the last step is labeled with that step's ink, never a fixed white or black.
		const labels = [...svg.querySelectorAll('text')].filter((t) => t.getAttribute('fill')?.startsWith('var(--chart-seq-ink-'));
		expect(labels.length).toBeGreaterThan(0);
		expect(labels.some((t) => t.getAttribute('fill') === 'var(--chart-seq-ink-700)')).toBe(true);
		expect([...svg.querySelectorAll('text')].some((t) => ['#ffffff', '#0b0b0b'].includes(t.getAttribute('fill') ?? ''))).toBe(false);
	});

	test('puts every value in the table', async () => {
		render(Heatmap, { props });

		await expect.element(page.getByRole('columnheader', { name: 'Week 0' })).toBeInTheDocument();
		await expect.element(page.getByRole('cell', { name: '100%' }).first()).toBeInTheDocument();
	});

	test('says so when there is nothing', async () => {
		render(Heatmap, { props: { ...props, cells: [], rows: [], cols: [] } });

		await expect.element(page.getByText('No data for this period.')).toBeVisible();
	});
});
