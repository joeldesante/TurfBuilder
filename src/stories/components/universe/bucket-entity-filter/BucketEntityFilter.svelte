<script lang="ts">
	import XIcon from 'phosphor-svelte/lib/X';

	// ---------------------------------------------------------------------------
	// Public types — exported so parent components can build FilterDefinition lists
	// ---------------------------------------------------------------------------

	export type FilterValueType = 'text' | 'number' | 'date' | 'select' | 'none';

	export interface FilterQualifier {
		/** Internal identifier used in logic, e.g. 'not_after', 'within' */
		value: string;
		/** Natural-language label shown to the user, e.g. "was not after", "is within" */
		label: string;
	}

	export interface FilterDefinition {
		/** Unique identifier for this filter field */
		id: string;
		/** Human-readable field name shown in the field selector, e.g. "Last Time Canvassed" */
		label: string;
		/** Available qualifiers for this field. Omit for fields that have no qualifier. */
		qualifiers?: FilterQualifier[];
		/** What kind of value input to render */
		valueType: FilterValueType;
		/** Options for a 'select' value type */
		valueOptions?: { value: string; label: string }[];
		/** Placeholder shown inside the value input */
		valuePlaceholder?: string;
		/** Short unit label appended after the value input, e.g. "days" or "miles" */
		valueUnit?: string;
	}

	// ---------------------------------------------------------------------------
	// Component props
	// ---------------------------------------------------------------------------

	interface Props {
		/** All available filter definitions the user can choose from */
		filters: FilterDefinition[];
		/** The currently selected filter field id */
		filterId?: string;
		/** The currently selected qualifier value */
		qualifierId?: string;
		/** The current filter value string */
		value?: string;
		/** Called when the user clicks the remove button */
		onremove?: () => void;
	}

	let {
		filters,
		filterId = $bindable(''),
		qualifierId = $bindable(''),
		value = $bindable(''),
		onremove
	}: Props = $props();

	// Derive the selected filter definition from the current filterId
	let selectedFilter = $derived(filters.find((f) => f.id === filterId) ?? null);

	// Derive qualifier items for the Select component
	let qualifierItems = $derived(
		(selectedFilter?.qualifiers ?? []).map((q) => ({ value: q.value, label: q.label }))
	);

	// Derive value type, defaulting to 'none' when no filter is selected
	let valueType = $derived(selectedFilter?.valueType ?? 'none');

	// Reset qualifier and value whenever the chosen filter field changes
	let previousFilterId = $state(filterId);
	$effect(() => {
		if (filterId !== previousFilterId) {
			previousFilterId = filterId;
			qualifierId = '';
			value = '';
		}
	});

	const filterItems = $derived(filters.map((f) => ({ value: f.id, label: f.label })));
</script>

<!-- Inline sentence layout: "Last Time Canvassed  was not after  [date]  ×" -->
<span class="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm">

	<!-- Field selector -->
	<span class="relative inline-flex items-center">
		<select
			bind:value={filterId}
			aria-label="Filter field"
			class="appearance-none cursor-pointer bg-transparent border-b-2 border-dashed
				   border-primary/50 hover:border-primary text-primary font-semibold
				   pr-4 pl-0.5 py-0 focus:outline-none focus:border-primary transition-colors"
		>
			<option value="" disabled>choose a filter...</option>
			{#each filters as f (f.id)}
				<option value={f.id}>{f.label}</option>
			{/each}
		</select>
		<span class="pointer-events-none absolute right-0 text-primary/60 text-xs leading-none">▾</span>
	</span>

	<!-- Qualifier selector — only shown when the selected filter has qualifiers -->
	{#if selectedFilter?.qualifiers && selectedFilter.qualifiers.length > 0}
		<span class="relative inline-flex items-center">
			<select
				bind:value={qualifierId}
				aria-label="Filter qualifier"
				class="appearance-none cursor-pointer bg-transparent border-b-2 border-dashed
					   border-outline hover:border-on-surface text-on-surface-subtle italic
					   pr-4 pl-0.5 py-0 focus:outline-none focus:border-on-surface transition-colors"
			>
				<option value="" disabled>condition...</option>
				{#each selectedFilter.qualifiers as q (q.value)}
					<option value={q.value}>{q.label}</option>
				{/each}
			</select>
			<span class="pointer-events-none absolute right-0 text-on-surface-subtle text-xs leading-none">▾</span>
		</span>
	{/if}

	<!-- Value input -->
	{#if valueType === 'text'}
		<input
			type="text"
			bind:value
			placeholder={selectedFilter?.valuePlaceholder ?? 'value...'}
			aria-label="Filter value"
			class="bg-transparent border-b-2 border-dashed border-outline hover:border-on-surface
				   focus:border-on-surface focus:outline-none px-0.5 py-0 w-32 transition-colors"
		/>
	{:else if valueType === 'number'}
		<input
			type="number"
			bind:value
			placeholder={selectedFilter?.valuePlaceholder ?? '0'}
			aria-label="Filter value"
			class="bg-transparent border-b-2 border-dashed border-outline hover:border-on-surface
				   focus:border-on-surface focus:outline-none px-0.5 py-0 w-20 transition-colors"
		/>
	{:else if valueType === 'date'}
		<input
			type="date"
			bind:value
			aria-label="Filter value"
			class="bg-transparent border-b-2 border-dashed border-outline hover:border-on-surface
				   focus:border-on-surface focus:outline-none px-0.5 py-0 transition-colors"
		/>
	{:else if valueType === 'select' && selectedFilter?.valueOptions}
		<span class="relative inline-flex items-center">
			<select
				bind:value
				aria-label="Filter value"
				class="appearance-none cursor-pointer bg-transparent border-b-2 border-dashed
					   border-outline hover:border-on-surface text-on-surface
					   pr-4 pl-0.5 py-0 focus:outline-none focus:border-on-surface transition-colors"
			>
				<option value="" disabled>{selectedFilter.valuePlaceholder ?? 'select...'}</option>
				{#each selectedFilter.valueOptions as opt (opt.value)}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
			<span class="pointer-events-none absolute right-0 text-on-surface-subtle text-xs leading-none">▾</span>
		</span>
	{/if}

	<!-- Unit label, e.g. "miles" or "years" -->
	{#if selectedFilter?.valueUnit && valueType !== 'none'}
		<span class="text-on-surface-subtle">{selectedFilter.valueUnit}</span>
	{/if}

	<!-- Remove -->
	{#if onremove}
		<button
			onclick={onremove}
			aria-label="Remove filter"
			class="inline-flex items-center justify-center w-4 h-4 rounded-full
				   text-on-surface-subtle hover:text-error hover:bg-error/10
				   focus:outline-none transition-colors self-center"
		>
			<XIcon size={12} />
		</button>
	{/if}

</span>
