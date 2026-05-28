<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import BucketEntityFilter from '$components/universe/bucket-entity-filter/BucketEntityFilter.svelte';
	import type { FilterDefinition } from '$components/universe/bucket-entity-filter/BucketEntityFilter.svelte';

	export type { FilterDefinition };

	type MatchType = 'ONE_OR_MORE' | 'ALL' | 'NONE';

	export interface FilterEntry {
		/** Stable key for list rendering */
		key: string;
		filterId: string;
		qualifierId: string;
		value: string;
	}

	interface Props {
		entity: string;
		matchType?: MatchType;
		/** The current list of filter rows. Bindable so parents can read state on submit. */
		filterEntries?: FilterEntry[];
		/** Available filter definitions for the entity type */
		filters?: FilterDefinition[];
	}

	let { entity, matchType = $bindable('ONE_OR_MORE'), filterEntries = $bindable([]), filters = [] }: Props = $props();

	const matchOptions: { value: MatchType; label: string }[] = [
		{ value: 'ONE_OR_MORE', label: 'ONE OR MORE' },
		{ value: 'ALL', label: 'ALL' },
		{ value: 'NONE', label: 'NONE' }
	];

	let nextKey = $state(0);

	function addFilter() {
		filterEntries = [
			...filterEntries,
			{ key: String(nextKey++), filterId: '', qualifierId: '', value: '' }
		];
	}

	function removeFilter(key: string) {
		filterEntries = filterEntries.filter((entry) => entry.key !== key);
	}

	// ---------------------------------------------------------------------------
	// Plain-English summary
	// ---------------------------------------------------------------------------

	function formatDate(iso: string): string {
		// iso is YYYY-MM-DD; avoid timezone shifts by parsing parts directly
		const [year, month, day] = iso.split('-').map(Number);
		return `${month}/${day}/${year}`;
	}

	/** Returns a prose fragment for one filter row, or null if the row is incomplete. */
	function describeFilter(entry: FilterEntry): string | null {
		const def = filters.find((f) => f.id === entry.filterId);
		if (!def) return null;

		const needsQualifier = (def.qualifiers?.length ?? 0) > 0;
		if (needsQualifier && !entry.qualifierId) return null;

		const needsValue = def.valueType !== 'none';
		if (needsValue && !entry.value) return null;

		// Field label lowercased for prose flow
		let fragment = def.label.toLowerCase();

		// Qualifier
		if (needsQualifier) {
			const qualifier = def.qualifiers!.find((q) => q.value === entry.qualifierId);
			if (qualifier) fragment += ` ${qualifier.label}`;
		}

		// Value — resolve select options to their display label; format dates
		if (needsValue) {
			let display = entry.value;
			if (def.valueType === 'select' && def.valueOptions) {
				const opt = def.valueOptions.find((o) => o.value === entry.value);
				if (opt) display = opt.label;
			} else if (def.valueType === 'date') {
				display = formatDate(entry.value);
			}
			fragment += ` ${display}`;
			if (def.valueUnit) fragment += ` ${def.valueUnit}`;
		}

		return fragment;
	}

	/** Joins an array into an Oxford-comma list with the given conjunction. */
	function oxfordJoin(items: string[], conjunction: string): string {
		if (items.length === 0) return '';
		if (items.length === 1) return items[0];
		if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
		return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items[items.length - 1]}`;
	}

	let summary = $derived((): string | null => {
		const fragments = filterEntries.map(describeFilter).filter((f): f is string => f !== null);
		if (fragments.length === 0) return null;

		const entityLower = entity.toLowerCase();

		if (matchType === 'NONE') {
			// Invert the framing — these people are EXCLUDED, not included
			const prefixed = fragments.map((f) => `whose ${f}`);
			const joined = oxfordJoin(prefixed, 'and');
			return `Your bucket will NOT include any ${entityLower} in your universe ${joined}.`;
		}

		// For ALL and ONE_OR_MORE, prefix each fragment with "whose"
		const prefixed = fragments.map((f) => `whose ${f}`);
		const conjunction = matchType === 'ALL' ? 'and' : 'or';
		const joined = oxfordJoin(prefixed, conjunction);
		return `Your bucket will include all ${entityLower} in your universe ${joined}.`;
	});
</script>

<div class="border p-4 rounded">
	<h2 class="text-lg">
		<span class="font-medium">{entity}</span> will be included in this new bucket of data.
	</h2>
	<p class="my-2">
		Show me {entity.toLowerCase()} that match
		<select bind:value={matchType}>
			{#each matchOptions as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
		of the following filters.
	</p>

	<ul class="flex flex-col gap-2 my-3 list-none">
		{#each filterEntries as entry, i (entry.key)}
			{#if i > 0}
				<li class="text-xs font-semibold tracking-widest text-on-surface-subtle uppercase px-0.5">
					{matchType === 'ONE_OR_MORE' ? 'OR' : 'AND'}
				</li>
			{/if}
			<li>
				<BucketEntityFilter
					{filters}
					bind:filterId={entry.filterId}
					bind:qualifierId={entry.qualifierId}
					bind:value={entry.value}
					onremove={() => removeFilter(entry.key)}
				/>
			</li>
		{/each}
	</ul>

	<Button variant="outline" onclick={addFilter}>Add Filter</Button>

	{#if summary()}
		<p class="mt-4 text-sm text-on-surface-subtle border-t border-outline pt-3 italic">
			{summary()}
		</p>
	{/if}
</div>
