<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FilterEditModal from './FilterEditModal.svelte';
	import { getFilter, defaultContactMade } from '$lib/shared/utils/filter-registry';
	import type { FilterOperation } from '$lib/shared/types/filters';

	const modal = (item: string, operation: FilterOperation, value: unknown, isNew = false) => ({
		open: true,
		definition: getFilter(item)!,
		filter: { item, operation, value },
		isNew
	});

	const { Story } = defineMeta({
		title: 'Components/Universe/FilterEditModal',
		component: FilterEditModal,
		args: { onsave: () => {}, oncancel: () => {} }
	});
</script>

<Story name="Text" args={modal('city', 'contains', 'phil')} />
<Story name="New Filter" args={modal('city', 'equals', '', true)} />
<Story name="Number" args={modal('age', 'greater_than', 65)} />
<Story name="Yes Or No" args={modal('has_email', 'equals', true)} />
<Story name="Contact Made" args={modal('contact_made', 'equals', defaultContactMade())} />
<Story
	name="Radius"
	args={modal('radius_from_point', 'within', { latitude: 39.95, longitude: -75.16, radius: 2 })}
/>
