<script lang="ts">
	import FilterGroup from '$components/universe/filter-group/FilterGroup.svelte';
	import type { FilterGroup as FilterGroupValue } from '$lib/shared/types/filters';
	import type { FilterRegistryEntry } from '$lib/shared/types/filter-registry';

	interface Props {
		/**
		 * The whole query. It is always a group: the root group is the foundation
		 * of the query and cannot be removed. Bindable so parents can read it on submit.
		 */
		group?: FilterGroupValue;
		/** Filters offered in the catalog. Defaults to the full shared registry. */
		catalog?: FilterRegistryEntry[];
	}

	let { group = $bindable({ operator: 'AND', filters: [] }), catalog }: Props = $props();
</script>

<FilterGroup {group} {catalog} onchange={(next) => (group = next)} />
