<script lang="ts">
	import { untrack } from 'svelte';
	import FilterGroup from '$components/universe/filter-group/FilterGroup.svelte';
	import type { FilterEntity, FilterGroup as FilterGroupValue } from '$lib/shared/types/filters';
	import {
		provideFilterEntity,
		provideFilterSource
	} from '$components/universe/filter-group/filter-source.svelte';
	import { createFilterSource } from '$lib/client/filter-source';
	import type { FilterSource } from '$lib/client/filter-source';
	import type { FilterRegistryEntry } from '$lib/shared/types/filter-registry';

	interface Props {
		/**
		 * The whole query. It is always a group: the root group is the foundation
		 * of the query and cannot be removed. Bindable so parents can read it on submit.
		 */
		group?: FilterGroupValue;
		/** Called with the whole query after each change, for parents that hold it themselves instead of binding. */
		onchange?: (group: FilterGroupValue) => void;
		/** Filters offered in the catalog. Defaults to the full shared registry. */
		catalog?: FilterRegistryEntry[];
		/** Small text above the root group's mode, saying what the query is for, such as "This bucket will contain". */
		label?: string;
		/** The kind of record the filters select, which their sentences name. Reads as "Records" when not given. */
		entity?: FilterEntity;
		/** The organization whose buckets, lists, and surveys the filters that name them offer. Without it (or `source`) those filters cannot load their choices. */
		orgId?: string;
		/** Overrides where those choices come from; defaults to the API for `orgId`. */
		source?: FilterSource;
	}

	let {
		group = $bindable({ operator: 'AND', filters: [] }),
		onchange,
		catalog,
		label,
		entity,
		orgId,
		source
	}: Props = $props();

	// Context is fixed when the component is created, so these are read once.
	const resolved = untrack(() => source ?? (orgId ? createFilterSource(orgId) : undefined));
	if (resolved) provideFilterSource(resolved);
	provideFilterEntity(() => entity);
</script>

<FilterGroup
	{group}
	{catalog}
	{label}
	onchange={(next) => {
		group = next;
		onchange?.(next);
	}}
/>
