<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LineChart from './LineChart.svelte';
	import { activeUsers, signups, wave } from '../fixtures';
	import { cumulative } from '$lib/shared/utils/chart-series';

	const { Story } = defineMeta({
		title: 'Components/Data Display/Charts/LineChart',
		component: LineChart,
		tags: ['autodocs'],
		argTypes: {
			series: { control: 'object', description: 'TimeSeries[] from $lib/shared/types/charts; dates are YYYY-MM-DD buckets.' },
			granularity: { control: 'select', options: ['day', 'week', 'month'] },
			format: { control: 'select', options: ['number', 'compact', 'percent', 'duration'] },
			area: { control: 'boolean' },
			stacked: { control: 'boolean' },
			smooth: { control: 'boolean' },
			loading: { control: 'boolean' },
			error: { control: 'text' }
		},
		parameters: {
			docs: {
				subtitle:
					'Change over time, for one or more series. Hover or use the arrow keys for a crosshair; the legend toggles series; up to four lines are labeled at their ends. Width follows its container.'
			}
		}
	});
</script>

<Story name="One series" args={{ title: 'New accounts', subtitle: 'Last 60 days', series: signups, area: true }} />

<Story name="Several series" args={{ title: 'Active users', series: activeUsers }} />

<Story
	name="Compared with the previous period"
	args={{
		title: 'Sign-ins',
		series: [
			{ key: 'now', label: 'This period', points: wave(30, 80, 20, 1) },
			{ key: 'before', label: 'Previous period', points: wave(30, 70, 20, 4), dashed: true, color: 'var(--chart-other)' }
		]
	}}
/>

<Story
	name="Stacked"
	args={{
		title: 'Visits by outcome',
		stacked: true,
		series: [
			{ key: 'a', label: 'Talked to someone', points: wave(30, 30, 10, 1) },
			{ key: 'b', label: 'No answer', points: wave(30, 60, 10, 2) }
		]
	}}
/>

<Story
	name="Cumulative"
	args={{ title: 'Total accounts', series: [{ key: 'total', label: 'Accounts', points: cumulative(signups[0].points, 4200) }], area: true }}
/>

<Story
	name="Large dataset"
	args={{ title: 'Two years, by day', series: [{ key: 'x', label: 'Events', points: wave(730, 400, 150) }], smooth: true }}
/>

<Story name="Single point" args={{ title: 'First day', series: [{ key: 'x', label: 'Events', points: [{ date: '2026-10-20', value: 12 }] }] }} />

<Story name="Empty" args={{ title: 'New accounts', series: [] }} />

<Story name="Loading" args={{ title: 'New accounts', series: [], loading: true }} />

<Story name="Error" args={{ title: 'New accounts', series: [], error: 'The chart could not be loaded.' }} />
