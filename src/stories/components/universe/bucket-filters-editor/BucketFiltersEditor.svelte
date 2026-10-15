<script lang="ts">
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';
	import EntityFilterEditor from '$components/universe/entity-filter-editor/EntityFilterEditor.svelte';
	import type { FilterSource } from '$lib/client/filter-source';
	import type { BucketFilters, FilterEntity, FilterGroup } from '$lib/shared/types/filters';
	import { filtersFor } from '$lib/shared/utils/filter-registry';

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

	let { filters = $bindable(), orgId, source, label = 'This bucket will contain' }: Props = $props();

	const KINDS: { kind: FilterEntity; name: string }[] = [
		{ kind: 'people', name: 'People' },
		{ kind: 'locations', name: 'Locations' }
	];

	// The filters of a kind that is unticked, kept so ticking it again brings them back.
	let stash = $state<Record<FilterEntity, FilterGroup | null>>({ people: null, locations: null });

	function include(kind: FilterEntity, on: boolean) {
		if (on) {
			filters = { ...filters, [kind]: stash[kind] ?? { operator: 'AND', filters: [] } };
		} else {
			stash[kind] = filters[kind];
			filters = { ...filters, [kind]: null };
		}
	}
</script>

<div class="flex flex-col gap-6">
	<div class="border rounded p-4">
		<h2>What entities would you like to include in this bucket?</h2>
		<div class="flex flex-row gap-6 my-2">
			{#each KINDS as { kind, name } (kind)}
				<Checkbox
					id="entity-{kind}"
					checked={filters[kind] !== null}
					onCheckedChange={(checked: boolean) => include(kind, checked)}
				>
					{name}
				</Checkbox>
			{/each}
		</div>
	</div>

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
