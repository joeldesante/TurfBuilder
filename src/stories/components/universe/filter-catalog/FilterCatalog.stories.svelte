<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FilterCatalog from './FilterCatalog.svelte';

	const { Story } = defineMeta({
		title: 'Components/Universe/FilterCatalog',
		component: FilterCatalog,
		args: { open: true, onOpenChange: () => {} }
	});
</script>

<Story name="Default" />

<Story name="No Filters" args={{ filters: [] }} />
