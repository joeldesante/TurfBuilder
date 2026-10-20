<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Heatmap from './Heatmap.svelte';
	import { cohortCells, cohortCols, cohortRows } from '../fixtures';
	import { formatBucket } from '$lib/shared/utils/chart-format';

	const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const hours = Array.from({ length: 24 }, (_, h) => String(h));
	const weekly = days.flatMap((d, di) =>
		hours.map((h, hi) => ({ row: d, col: h, value: Math.round(Math.max(0, 40 * Math.sin(((hi - 6) / 24) * Math.PI) + (di > 4 ? 20 : 0))) }))
	);

	const { Story } = defineMeta({
		title: 'Components/Data Display/Charts/Heatmap',
		component: Heatmap,
		tags: ['autodocs'],
		parameters: {
			docs: {
				subtitle:
					'A grid of values on one sequential ramp, such as retention cohorts or activity by hour. Cells with no data are drawn apart from zero.'
			}
		}
	});
</script>

<Story
	name="Retention cohorts"
	args={{
		title: 'Weekly retention',
		subtitle: 'Share of each sign-up week still active',
		cells: cohortCells,
		rows: cohortRows,
		cols: cohortCols,
		rowLabel: (r: string) => formatBucket(r, 'week'),
		colLabel: (c: string) => `Week ${c}`,
		format: 'percent',
		max: 1,
		rowTitle: 'Signed up',
		colTitle: 'Weeks since'
	}}
/>

<Story
	name="Activity by hour"
	args={{ title: 'When people canvass', cells: weekly, rows: days, cols: hours, cellLabels: false, rowTitle: 'Day', colTitle: 'Hour' }}
/>

<Story name="Empty" args={{ title: 'Weekly retention', cells: [], rows: [], cols: [] }} />
