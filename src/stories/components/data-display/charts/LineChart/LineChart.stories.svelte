<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LineChart from './LineChart.svelte';
	import type { Series } from './LineChart.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Display/Charts/LineChart',
		component: LineChart,
		tags: ['autodocs']
	});

	function weeklySeries(name: string, color: string, values: number[], showArea = false): Series {
		return {
			name,
			color,
			showArea,
			data: values.map((qty, i) => ({
				date: new Date(Date.UTC(2024, 0, 1 + i * 7)),
				qty
			}))
		};
	}

	const numeric: Series[] = [weeklySeries('Doors Knocked', 'var(--primary)', [10, 40, 25, 60, 45, 80])];

	const withArea: Series[] = [
		weeklySeries('Doors Knocked', 'var(--primary)', [10, 40, 25, 60, 45, 80], true)
	];

	const multiSeries: Series[] = [
		weeklySeries('Doors Knocked', 'var(--primary)', [10, 40, 25, 60, 45, 80]),
		weeklySeries('Conversations', 'var(--secondary)', [5, 20, 15, 35, 30, 55])
	];

	const monthlySeries: Series[] = [
		{
			name: 'Responses',
			color: 'var(--primary)',
			data: [
				{ date: new Date(Date.UTC(2024, 0, 1)), qty: 10 },
				{ date: new Date(Date.UTC(2024, 1, 1)), qty: 40 },
				{ date: new Date(Date.UTC(2024, 2, 1)), qty: 25 },
				{ date: new Date(Date.UTC(2024, 3, 1)), qty: 60 },
				{ date: new Date(Date.UTC(2024, 4, 1)), qty: 45 },
				{ date: new Date(Date.UTC(2024, 5, 1)), qty: 80 }
			]
		}
	];

	const dailySeries: Series[] = [
		{
			name: 'Doors Knocked',
			color: 'var(--primary)',
			data: Array.from({ length: 7 }, (_, i) => ({
				date: new Date(Date.UTC(2024, 0, 1 + i)),
				qty: [10, 14, 9, 18, 22, 12, 25][i]
			}))
		}
	];

	const forecastSeries: Series[] = [
		weeklySeries('Actual', 'var(--primary)', [10, 40, 25, 60, 45, 80]),
		{
			name: 'Forecast',
			color: 'var(--outline)',
			data: [5, 6, 7, 8].map((week) => ({
				date: new Date(Date.UTC(2024, 0, 1 + week * 7)),
				qty: [80, 90, 95, 110][week - 5]
			}))
		}
	];
</script>

<Story name="Numeric" args={{ series: numeric }} />

<Story name="With Title" args={{ title: 'Doors Knocked', subtitle: 'Last 6 weeks', series: numeric }} />

<Story name="With Area" args={{ title: 'Doors Knocked', series: withArea }} />

<Story name="Multi-Series" args={{ title: 'Field Activity', series: multiSeries }} />

<Story name="Daily Granularity" args={{ series: dailySeries, granularity: 'day' }} />

<Story name="Weekly Granularity" args={{ series: numeric, granularity: 'week' }} />

<Story name="Monthly Granularity" args={{ title: 'Responses', series: monthlySeries, granularity: 'month' }} />

<Story name="Forecast" args={{ title: 'Doors Knocked', subtitle: 'Actual vs. forecast', series: forecastSeries }} />

<Story name="Empty" args={{ title: 'No Data Yet', series: [] }} />
