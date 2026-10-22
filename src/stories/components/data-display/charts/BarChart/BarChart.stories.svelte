<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BarChart from './BarChart.svelte';
	import { signups, topOrgs, visitsStack } from '../fixtures';

	const { Story } = defineMeta({
		title: 'Components/Data Display/Charts/BarChart',
		component: BarChart,
		tags: ['autodocs'],
		argTypes: {
			data: { control: 'object', description: 'CategoryDatum[]: one bar per category.' },
			series: { control: 'object', description: 'TimeSeries[]: one bar or stack per time bucket.' },
			orientation: { control: 'select', options: ['horizontal', 'vertical'] },
			stacked: { control: 'boolean' },
			valueLabels: { control: 'boolean' }
		},
		parameters: {
			docs: {
				subtitle:
					'Bars for rankings (categories, horizontal so long names read) or for counts per period (time buckets, stacked or side by side). Only the data end of each bar is rounded.'
			}
		}
	});
</script>

<Story name="Ranking" args={{ title: 'Most active organizations', subtitle: 'Events, last 30 days', data: topOrgs }} />

<Story name="Ranking with links" args={{ title: 'Most active organizations', data: topOrgs, href: () => '#' }} />

<Story name="Vertical categories" args={{ title: 'Organizations by size', orientation: 'vertical', data: topOrgs.slice(0, 4) }} />

<Story name="Stacked over time" args={{ title: 'Visits by outcome', series: visitsStack, granularity: 'day' }} />

<Story name="Side by side over time" args={{ title: 'Visits by outcome', series: visitsStack, stacked: false }} />

<Story name="One series over time" args={{ title: 'New accounts', series: [{ ...signups[0], points: signups[0].points.slice(0, 20) }] }} />

<Story name="Empty" args={{ title: 'Most active organizations', data: [] }} />
