<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ActivityMap, { type ActivityPoint } from './ActivityMap.svelte';

	// A small grid of places around Germantown, Philadelphia, in each status.
	const STATUSES = ['contacted', 'no-contact', 'unvisited'] as const;
	const points: ActivityPoint[] = Array.from({ length: 60 }, (_, i) => ({
		id: `loc-${i}`,
		name: `Location ${i + 1}`,
		longitude: -75.175 + (i % 10) * 0.0015,
		latitude: 40.035 + Math.floor(i / 10) * 0.0012,
		status: STATUSES[i % 3]
	}));

	const { Story } = defineMeta({
		title: 'Components/Data Display/ActivityMap',
		component: ActivityMap,
		tags: ['autodocs']
	});
</script>

<Story name="Default" args={{ points, class: 'h-[560px]' }} />
