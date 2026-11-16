<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LayerCatalogue from './LayerCatalogue.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/LayerCatalogue',
		component: LayerCatalogue,
		tags: ['autodocs']
	});
</script>

<Story
	name="Default"
	args={{ onPick: () => {}, getViewBounds: () => [-75.3, 39.85, -74.95, 40.15] }}
/>

<Story name="Loading a layer" args={{ onPick: () => {}, loadingId: 'census-states' }} />
