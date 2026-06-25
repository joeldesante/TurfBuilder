<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import * as Plot from '@observablehq/plot';
	import LineChart from './LineChart.svelte';
	import { tipStyles } from '$lib/chart-theme';

	const { Story } = defineMeta({
		title: 'Components/Data Display/Charts/LineChart',
		component: LineChart,
		tags: ['autodocs']
	});

	const numeric = [
		{ week: 0, doors: 10 },
		{ week: 1, doors: 40 },
		{ week: 2, doors: 25 },
		{ week: 3, doors: 60 },
		{ week: 4, doors: 45 },
		{ week: 5, doors: 80 }
	];

	const timeSeries = [
		{ date: new Date('2024-01-01'), responses: 10 },
		{ date: new Date('2024-02-01'), responses: 40 },
		{ date: new Date('2024-03-01'), responses: 25 },
		{ date: new Date('2024-04-01'), responses: 60 },
		{ date: new Date('2024-05-01'), responses: 45 },
		{ date: new Date('2024-06-01'), responses: 80 }
	];

	const multiSeries = [
		{ week: 0, doors: 10, conversations: 5 },
		{ week: 1, doors: 40, conversations: 20 },
		{ week: 2, doors: 25, conversations: 15 },
		{ week: 3, doors: 60, conversations: 35 },
		{ week: 4, doors: 45, conversations: 30 },
		{ week: 5, doors: 80, conversations: 55 }
	];

	const actual = [
		{ week: 0, doors: 10 },
		{ week: 1, doors: 40 },
		{ week: 2, doors: 25 },
		{ week: 3, doors: 60 },
		{ week: 4, doors: 45 },
		{ week: 5, doors: 80 }
	];

	const forecast = [
		{ week: 5, doors: 80 },
		{ week: 6, doors: 90 },
		{ week: 7, doors: 95 },
		{ week: 8, doors: 110 }
	];
</script>

<Story
	name="Tooltip on Hover"
	args={{
		options: {
			x: { label: 'Week' },
			y: { label: 'Doors Knocked' },
			marks: [
				Plot.lineY(numeric, { x: 'week', y: 'doors' }),
				Plot.dot(numeric, Plot.pointerX({ x: 'week', y: 'doors', fill: 'var(--primary)' })),
				Plot.tip(numeric, Plot.pointerX({
					x: 'week',
					y: 'doors',
					title: (d) => `Week ${d.week}\n${d.doors} doors knocked`,
					...tipStyles
				}))
			]
		}
	}}
/>

<Story
	name="Numeric"
	args={{
		options: {
			x: { label: 'Week' },
			y: { label: 'Doors Knocked' },
			marks: [Plot.lineY(numeric, { x: 'week', y: 'doors' })]
		}
	}}
/>

<Story
	name="With Title"
	args={{
		title: 'Doors Knocked',
		subtitle: 'Last 6 weeks',
		options: {
			x: { label: 'Week' },
			y: { label: 'Doors Knocked' },
			marks: [Plot.lineY(numeric, { x: 'week', y: 'doors' })]
		}
	}}
/>

<Story
	name="Time Axis"
	args={{
		options: {
			x: { label: 'Date' },
			y: { label: 'Responses' },
			marks: [Plot.lineY(timeSeries, { x: 'date', y: 'responses' })]
		}
	}}
/>

<Story
	name="Multi-Series"
	args={{
		options: {
			color: { legend: true },
			x: { label: 'Week' },
			y: { label: 'Count' },
			marks: [
				Plot.lineY(multiSeries, { x: 'week', y: 'doors', stroke: () => 'Doors Knocked' }),
				Plot.lineY(multiSeries, { x: 'week', y: 'conversations', stroke: () => 'Conversations' })
			]
		}
	}}
/>

<Story
	name="Trend Line"
	args={{
		options: {
			x: { label: 'Week' },
			y: { label: 'Doors Knocked' },
			marks: [
				Plot.lineY(numeric, { x: 'week', y: 'doors' }),
				Plot.linearRegressionY(numeric, {
					x: 'week',
					y: 'doors',
					stroke: 'var(--primary)',
					strokeDasharray: '4 4'
				})
			]
		}
	}}
/>

<Story
	name="Target Line"
	args={{
		options: {
			x: { label: 'Week' },
			y: { label: 'Doors Knocked' },
			marks: [
				Plot.lineY(actual, { x: 'week', y: 'doors' }),
				Plot.ruleY([100], { stroke: 'var(--primary)', strokeDasharray: '4 4' }),
				Plot.text([{ week: 5, doors: 100 }], {
					x: 'week',
					y: 'doors',
					text: () => 'Goal: 100',
					dy: -8,
					fill: 'var(--primary)',
					fontSize: 11
				})
			]
		}
	}}
/>

<Story
	name="Forecast"
	args={{
		options: {
			x: { label: 'Week' },
			y: { label: 'Doors Knocked' },
			marks: [
				Plot.lineY(actual, { x: 'week', y: 'doors' }),
				Plot.lineY(forecast, {
					x: 'week',
					y: 'doors',
					strokeDasharray: '4 4',
					strokeOpacity: 0.6
				}),
				Plot.ruleX([5], { stroke: 'var(--outline)', strokeDasharray: '2 2' }),
				Plot.text([{ week: 5, doors: 0 }], {
					x: 'week',
					y: 'doors',
					text: () => 'Forecast',
					dx: 8,
					textAnchor: 'start',
					fill: 'var(--on-surface-subtle)',
					fontSize: 11
				})
			]
		}
	}}
/>

<Story
	name="Custom Formatters"
	args={{
		options: {
			marginLeft: 80,
			x: { label: 'Week', tickFormat: (v) => `Wk ${v}` },
			y: { label: 'Doors', tickFormat: (v) => `${v} doors` },
			marks: [Plot.lineY(numeric, { x: 'week', y: 'doors' })]
		}
	}}
/>
