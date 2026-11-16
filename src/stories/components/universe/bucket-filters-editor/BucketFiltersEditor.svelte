<script lang="ts">
	import EntityFilterEditor from '$components/universe/entity-filter-editor/EntityFilterEditor.svelte';
	import type { FilterSource } from '$lib/client/filter-source';
	import type { BucketFilters, FilterEntity, FilterGroup } from '$lib/shared/types/filters';
	import { filtersFor } from '$lib/shared/utils/filter-registry';
	import { SELECTABLE_ENTITIES } from '$lib/shared/utils/filters';

	interface Props {
		/** What the bucket selects: a filter group for each kind of record it includes, null for each it does not. */
		filters: BucketFilters;
		/** The organization whose buckets, lists, and surveys the filters offer. */
		orgId?: string;
		/** Overrides where those choices come from; for stories and tests. */
		source?: FilterSource;
		/** Small text above each editor, saying what the filters are for. */
		label?: string;
	}

	let {
		filters = $bindable(),
		orgId,
		source,
		label = 'This bucket will contain'
	}: Props = $props();

	// Every record is a contact with a schema, so a bucket always filters its
	// contacts; there is nothing to tick. The data model still calls them
	// "locations".
	const KINDS = (
		[{ kind: 'locations', name: 'Contacts' }] as { kind: FilterEntity; name: string }[]
	).filter(({ kind }) => SELECTABLE_ENTITIES.includes(kind));

	// A bucket saved or built without a filter for the kind gets an empty one, so
	// the editor is always there to fill in.
	$effect(() => {
		for (const { kind } of KINDS) {
			if (filters[kind] === null) {
				filters = { ...filters, [kind]: { operator: 'AND', filters: [] } };
			}
		}
	});
</script>

<div class="flex flex-col gap-6">
	{#each KINDS as { kind, name } (kind)}
		{#if filters[kind] !== null}
			<section class="flex flex-col gap-2" aria-label="{name} filters">
				<h2 class="text-sm font-medium">{name}</h2>
				<EntityFilterEditor
					entity={kind}
					catalog={filtersFor(kind)}
					{label}
					{orgId}
					{source}
					group={filters[kind] as FilterGroup}
					onchange={(group) => (filters = { ...filters, [kind]: group })}
				/>
			</section>
		{/if}
	{/each}
</div>
