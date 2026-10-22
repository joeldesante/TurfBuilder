<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import DonutChart from './DonutChart.svelte';
	import { longTail, signInMethods } from '../fixtures';

	const { Story } = defineMeta({
		title: 'Components/Data Display/Charts/DonutChart',
		component: DonutChart,
		tags: ['autodocs'],
		argTypes: {
			data: { control: 'object', description: 'CategoryDatum[]: the parts of one whole.' },
			innerRadius: { control: { type: 'range', min: 0, max: 0.8, step: 0.05 } },
			maxSlices: { control: { type: 'number', min: 2, max: 8 } }
		},
		parameters: {
			docs: {
				subtitle:
					'Shares of one whole, with each value and percent in the legend. Long tails fold into "Other" so no slice needs a ninth color. innerRadius 0 draws a pie.'
			}
		}
	});
</script>

<Story name="Donut" args={{ title: 'Sign-in methods', data: signInMethods }} />

<Story name="Pie" args={{ title: 'Sign-in methods', data: signInMethods, innerRadius: 0 }} />

<Story name="Long tail folded into Other" args={{ title: 'Event mix', data: longTail }} />

<Story name="Shares" args={{ title: 'Email verified', centerLabel: 'Accounts', data: [{ key: 'yes', label: 'Verified', value: 930 }, { key: 'no', label: 'Not verified', value: 214 }] }} />

<Story name="Empty" args={{ title: 'Sign-in methods', data: [] }} />
