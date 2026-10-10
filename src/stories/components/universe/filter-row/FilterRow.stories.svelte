<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FilterRow from './FilterRow.svelte';
	import { getFilter } from '$lib/shared/utils/filter-registry';
	import type { FilterOperation } from '$lib/shared/types/filters';

	const { Story } = defineMeta({
		title: 'Components/Universe/FilterRow',
		component: FilterRow,
		args: { onchange: () => {}, onremove: () => {} }
	});

	const row = (item: string, operation: FilterOperation, value: unknown) => ({
		definition: getFilter(item)!,
		filter: { item, operation, value }
	});
</script>

<Story name="Text" args={row('city', 'equals', 'Austin')} />
<Story name="Number With Unit" args={row('distance_from_address', 'less_than', 5)} />
<Story name="Date" args={row('date_of_birth', 'greater_than', '1990-01-01')} />
<Story name="Boolean" args={row('has_email', 'equals', true)} />
<Story name="Select" args={row('door_open_response', 'equals', 'yes')} />
<Story
	name="Radius"
	args={row('radius_from_point', 'within', { latitude: 40.0259, longitude: -75.2238, radius: 2 })}
/>
<Story name="Polygon" args={row('inside_drawn_region', 'not_within', '')} />
