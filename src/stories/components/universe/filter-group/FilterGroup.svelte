<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import Dropdown from '$components/data-inputs/dropdown/Dropdown.svelte';
	import DragHandle from '$components/universe/drag-handle/DragHandle.svelte';
	import FilterCatalog from '$components/universe/filter-catalog/FilterCatalog.svelte';
	import FilterRow from '$components/universe/filter-row/FilterRow.svelte';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import XIcon from 'phosphor-svelte/lib/X';
	import type { Filter, FilterGroup as FilterGroupValue } from '$lib/shared/types/filters';
	import type { FilterRegistryEntry } from '$lib/shared/types/filter-registry';
	import { defaultFilterValue, getFilter } from '$lib/shared/utils/filter-registry';
	import { isFilterGroup } from '$lib/shared/utils/filters';
	import { entityName } from '$lib/shared/utils/filter-sentence';
	import { useFilterEntity } from './filter-source.svelte';
	import { isSameOrDescendant, moveNode } from '$lib/shared/utils/filter-tree';
	import type { FilterPath } from '$lib/shared/utils/filter-tree';
	import { FilterDnd, provideFilterDnd, useFilterDnd } from './filter-dnd.svelte';
	// A group can contain groups, so the component renders itself.
	import Self from './FilterGroup.svelte';

	interface Props {
		group: FilterGroupValue;
		onchange: (group: FilterGroupValue) => void;
		/** Omit for the root group, which is the foundation of the query and cannot be removed. */
		onremove?: () => void;
		/** Filters offered in the catalog. Defaults to the full shared registry. */
		catalog?: FilterRegistryEntry[];
		/** Small text above the mode, saying what the query is for, such as "This bucket will contain". */
		label?: string;
		/** Where this group sits in the query. Empty for the root; set by the parent group. */
		path?: FilterPath;
		/** When given, a grip is shown in the header that starts a drag to reorder this group. */
		ondragstart?: (event: DragEvent) => void;
		ondragend?: (event: DragEvent) => void;
	}

	const { group, onchange, onremove, catalog, label, path = [], ondragstart, ondragend }: Props = $props();

	/** How a group reads and what it is stored as: the operator, and whether it is inverted. */
	const MODES = {
		AND: { operator: 'AND', not: false, label: 'matching every filter in this group' },
		OR: { operator: 'OR', not: false, label: 'matching at least one filter in this group' },
		NOT_OR: { operator: 'OR', not: true, label: 'matching no filter in this group' },
		NOT_AND: { operator: 'AND', not: true, label: 'failing at least one filter in this group' }
	} as const;
	type Mode = keyof typeof MODES;

	const entity = useFilterEntity();

	// Each mode says who is selected and by which filters, e.g. "Locations matching no filter in this group".
	const operatorItems = $derived(
		(Object.keys(MODES) as Mode[]).map((mode) => ({
			value: mode,
			label: `${entityName(entity())} ${MODES[mode].label}`
		}))
	);

	const mode = $derived<Mode>(
		group.not ? (group.operator === 'OR' ? 'NOT_OR' : 'NOT_AND') : group.operator
	);

	function setMode(mode: Mode) {
		const { operator, not } = MODES[mode];
		// Leave `not` out rather than false, so a plain group stays as it was.
		const next: FilterGroupValue = { ...group, operator };
		if (not) next.not = true;
		else delete next.not;
		onchange(next);
	}

	let catalogOpen = $state(false);

	/**
	 * Index of the filter just added, so its row opens the editor on creation.
	 * Cleared once the row has been drawn: the row reads it only when created,
	 * and a later move into this slot must not open an editor.
	 */
	let justAdded = $state<number | null>(null);
	$effect(() => {
		if (justAdded !== null) justAdded = null;
	});

	// The root owns the drag state and applies moves to the whole query; nested groups share it.
	const dnd =
		useFilterDnd() ??
		(() => {
			const root = new FilterDnd((from, to) => onchange(moveNode(group, from, to)));
			provideFilterDnd(root);
			return root;
		})();

	/** Where a drop would land: before or after the entry at `index`. */
	let dropTarget = $state<{ index: number; after: boolean } | null>(null);

	function setFilters(filters: FilterGroupValue['filters']) {
		onchange({ ...group, filters });
	}

	function addFilter(entry: FilterRegistryEntry) {
		justAdded = group.filters.length;
		setFilters([
			...group.filters,
			{
				item: entry.id,
				operation: entry.operations[0],
				value: defaultFilterValue(entry)
			}
		]);
		catalogOpen = false;
	}

	function addGroup() {
		setFilters([...group.filters, { operator: 'AND', filters: [] }]);
		catalogOpen = false;
	}

	function updateEntry(index: number, next: Filter | FilterGroupValue) {
		setFilters(group.filters.map((entry, i) => (i === index ? next : entry)));
	}

	function removeEntry(index: number) {
		setFilters(group.filters.filter((_, i) => i !== index));
	}

	function startDrag(event: DragEvent, index: number) {
		dnd.dragging = [...path, index];
		if (!event.dataTransfer) return;
		event.dataTransfer.effectAllowed = 'move';
		// Firefox will not start a drag without data.
		event.dataTransfer.setData('text/plain', 'filter');
		const card = (event.currentTarget as HTMLElement).closest('li');
		if (card) event.dataTransfer.setDragImage(card, 16, 16);
	}

	function endDrag() {
		dnd.dragging = null;
		dropTarget = null;
	}

	/** Dropping beside a node that is inside the dragged group would nest it in itself. */
	function canDropAt(parent: FilterPath): boolean {
		return !!dnd.dragging && !isSameOrDescendant(parent, dnd.dragging);
	}

	function dragOverEntry(event: DragEvent, index: number) {
		if (!canDropAt([...path, index])) return;
		// Only the innermost group under the pointer takes the drop.
		event.preventDefault();
		event.stopPropagation();
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		dropTarget = { index, after: event.clientY >= box.top + box.height / 2 };
	}

	function dropOnEntry(event: DragEvent, index: number) {
		if (!canDropAt([...path, index])) return;
		event.preventDefault();
		event.stopPropagation();
		const after = dropTarget?.index === index ? dropTarget.after : false;
		dropTarget = null;
		dnd.drop([...path, after ? index + 1 : index]);
	}

	function dragOverEmpty(event: DragEvent) {
		if (!canDropAt(path)) return;
		event.preventDefault();
		event.stopPropagation();
		dropTarget = { index: 0, after: false };
	}

	function dropOnEmpty(event: DragEvent) {
		if (!canDropAt(path)) return;
		event.preventDefault();
		event.stopPropagation();
		dropTarget = null;
		dnd.drop([...path, 0]);
	}

	function isBeingDragged(index: number): boolean {
		return !!dnd.dragging && isSameOrDescendant([...path, index], dnd.dragging);
	}
</script>

<div class="rounded border {onremove ? 'bg-surface-container-low' : ''}">
	<div class="flex flex-nowrap items-center border-b">
		<div class="flex min-w-0 flex-nowrap items-center gap-2 p-2">
			{#if ondragstart}
				<DragHandle {ondragstart} ondragend={(e) => { endDrag(); ondragend?.(e); }} />
			{/if}
			<div class="flex min-w-0 flex-col gap-1">
				{#if label}
					<span class="text-xs text-on-surface-subtle">{label}</span>
				{/if}
				<Dropdown
					aria-label="Group operator"
					class="min-w-0 max-sm:text-sm [&>span]:truncate"
					items={operatorItems}
					value={mode}
					onValueChange={(next) => setMode(next as Mode)}
				/>
			</div>
		</div>
		<div class="ml-auto shrink-0 border-l p-2">
			<Button
				class="whitespace-nowrap max-sm:px-2"
				aria-label="Add Filter"
				onclick={() => (catalogOpen = true)}
			>
				<PlusIcon />
				<span class="max-sm:hidden">Add Filter</span>
			</Button>
		</div>
		{#if onremove}
			<div class="border-l p-2">
				<Button variant="ghost" size="sm" iconOnly aria-label="Remove group" onclick={onremove}>
					<XIcon />
				</Button>
			</div>
		{/if}
	</div>
	<div class="p-2">
		{#if group.filters.length === 0}
			<p
				class="rounded p-2 text-sm text-on-surface-subtle {dropTarget ? 'bg-primary/10' : ''}"
				ondragover={dragOverEmpty}
				ondragleave={() => (dropTarget = null)}
				ondrop={dropOnEmpty}
			>
				No filters added yet.
			</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each group.filters as entry, i (i)}
					<li
						class="relative {isBeingDragged(i) ? 'opacity-50' : ''}"
						ondragover={(e) => dragOverEntry(e, i)}
						ondragleave={() => (dropTarget = null)}
						ondrop={(e) => dropOnEntry(e, i)}
					>
						{#if dropTarget?.index === i}
							<div
								class="pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded bg-primary {dropTarget.after
									? '-bottom-1.5'
									: '-top-1.5'}"
							></div>
						{/if}
						{#if i > 0}
							<p class="mb-2 px-1 text-xs font-bold text-on-surface-subtle">{group.operator}</p>
						{/if}
						{#if isFilterGroup(entry)}
							<Self
								group={entry}
								{catalog}
								path={[...path, i]}
								onchange={(next) => updateEntry(i, next)}
								onremove={() => removeEntry(i)}
								ondragstart={(e) => startDrag(e, i)}
								ondragend={endDrag}
							/>
						{:else}
							{@const definition = getFilter(entry.item)}
							{#if definition}
								<FilterRow
									{definition}
									filter={entry}
									startOpen={justAdded === i}
									onchange={(next) => updateEntry(i, next)}
									onremove={() => removeEntry(i)}
									ondragstart={(e) => startDrag(e, i)}
									ondragend={endDrag}
								/>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<FilterCatalog
	open={catalogOpen}
	filters={catalog}
	onOpenChange={(next) => (catalogOpen = next)}
	onselect={addFilter}
	onselectgroup={addGroup}
/>
