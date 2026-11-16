<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import GeometryBadge from './GeometryBadge.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Display/GeometryBadge',
		component: GeometryBadge,
		tags: ['autodocs']
	});
</script>

<Story name="Polygons" args={{ kind: 'polygon' }} />
<Story name="Lines" args={{ kind: 'line', count: 12 }} />
<Story name="Points with a count" args={{ kind: 'point', count: 1204 }} />
