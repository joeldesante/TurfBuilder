<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FilterGroup from './FilterGroup.svelte';
	import type { FilterGroup as FilterGroupValue } from '$lib/shared/types/filters';

	const { Story } = defineMeta({
		title: 'Components/Universe/FilterGroup',
		component: FilterGroup
	});

	const nested: FilterGroupValue = {
		operator: 'AND',
		filters: [
			{ item: 'city', operation: 'equals', value: 'Austin' },
			{
				operator: 'OR',
				filters: [
					{ item: 'age', operation: 'greater_than', value: 65 },
					{ item: 'has_email', operation: 'equals', value: true }
				]
			}
		]
	};
</script>

<script lang="ts">
	let empty = $state<FilterGroupValue>({ operator: 'AND', filters: [] });
	let withNested = $state<FilterGroupValue>(nested);
</script>

<Story name="Root Empty">
	<FilterGroup group={empty} onchange={(next) => (empty = next)} />
</Story>

<Story name="Nested Groups">
	<FilterGroup group={withNested} onchange={(next) => (withNested = next)} />
</Story>
