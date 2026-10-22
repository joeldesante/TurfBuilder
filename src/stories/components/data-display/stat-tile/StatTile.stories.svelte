<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StatTile from './StatTile.svelte';
	import { wave } from '$components/data-display/charts/fixtures';

	const { Story } = defineMeta({
		title: 'Components/Data Display/StatTile',
		component: StatTile,
		tags: ['autodocs'],
		argTypes: {
			goodDirection: { control: 'select', options: ['up', 'down', 'none'] },
			format: { control: 'select', options: ['number', 'compact', 'percent', 'duration'] },
			change: { control: 'number' }
		},
		parameters: {
			docs: {
				subtitle:
					'One headline number, its change against the previous period (green when it moved the good way), and an optional trend. Use instead of a chart when the job is a single figure.'
			}
		}
	});
</script>

<Story name="Growing" args={{ label: 'New accounts', value: 182, change: 0.18, changeLabel: 'vs the 7 days before', trend: wave(14, 24, 8) }} />

<Story name="Bad direction" args={{ label: 'Failed emails', value: 7, change: 0.4, goodDirection: 'down', changeLabel: 'vs the 7 days before' }} />

<Story name="New" args={{ label: 'Visits', value: 31, change: null }} />

<Story name="Share" args={{ label: 'Stickiness', value: 0.214, format: 'percent', hint: 'Daily over monthly active users' }} />

<Story name="As a link" args={{ label: 'Organizations', value: 48, hint: '31 active in the last 30 days', href: '#' }} />
