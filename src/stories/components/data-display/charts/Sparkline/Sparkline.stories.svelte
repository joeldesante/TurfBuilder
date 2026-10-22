<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Sparkline from './Sparkline.svelte';
	import { wave } from '../fixtures';

	const { Story } = defineMeta({
		title: 'Components/Data Display/Charts/Sparkline',
		component: Sparkline,
		tags: ['autodocs'],
		parameters: {
			docs: { subtitle: 'A tiny trend with no axes, for stat tiles and table cells. Fills its container width.' }
		}
	});
</script>

<Story name="Trend" args={{ points: wave(30, 20, 8), label: 'Sign-ups, last 30 days' }} />

<Story name="Line only" args={{ points: wave(30, 20, 8), label: 'Sign-ups', area: false, color: 'var(--chart-2)' }} />

<Story name="Not enough data" args={{ points: [{ date: '2026-10-20', value: 3 }], label: 'Sign-ups' }} />
