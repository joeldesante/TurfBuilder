<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import DragHandle from '$components/universe/drag-handle/DragHandle.svelte';
	import FilterEditModal from '$components/universe/filter-edit-modal/FilterEditModal.svelte';
	import FilterSentence from '$components/universe/filter-sentence/FilterSentence.svelte';
	import PolygonPickerModal from '$components/universe/polygon-picker-modal/PolygonPickerModal.svelte';
	import RadiusPickerModal from '$components/universe/radius-picker-modal/RadiusPickerModal.svelte';
	import {
		useFilterEntity,
		useFilterSource
	} from '$components/universe/filter-group/filter-source.svelte';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimple';
	import XIcon from 'phosphor-svelte/lib/X';
	import { resolveSentenceNames } from '$lib/client/filter-names';
	import type { FilterRegistryEntry } from '$lib/shared/types/filter-registry';
	import type { Filter, RadiusValue } from '$lib/shared/types/filters';
	import { describeFilter } from '$lib/shared/utils/filter-sentence';
	import type { SentenceNames } from '$lib/shared/utils/filter-sentence';

	interface Props {
		/** The registry entry this row shows; decides its wording and the settings in the editor. */
		definition: FilterRegistryEntry;
		filter: Filter;
		onchange: (filter: Filter) => void;
		onremove: () => void;
		/**
		 * Opens the editor as soon as the row appears, for a filter that has just
		 * been added. Cancelling the editor then removes the filter again, since
		 * it was never configured. Read once, when the row is created.
		 */
		startOpen?: boolean;
		/** When given, a grip is shown on the left that starts a drag to reorder the filter. */
		ondragstart?: (event: DragEvent) => void;
		ondragend?: (event: DragEvent) => void;
	}

	const {
		definition,
		filter,
		onchange,
		onremove,
		startOpen = false,
		ondragstart,
		ondragend
	}: Props = $props();

	const filterSource = useFilterSource();
	const entity = useFilterEntity();

	// svelte-ignore state_referenced_locally
	let editing = $state(startOpen);
	// Still waiting for its first save, so cancelling throws it away.
	// svelte-ignore state_referenced_locally
	let unsaved = $state(startOpen);
	let viewing = $state<'radius' | 'polygon' | null>(null);

	/** The names behind the ids in the value, which the sentence shows instead of the ids. */
	let names = $state<SentenceNames>({});
	$effect(() => {
		const source = filterSource;
		const current = $state.snapshot(filter);
		if (!source) return;
		let stale = false;
		resolveSentenceNames(source, current).then((resolved) => {
			if (!stale) names = resolved;
		});
		return () => {
			stale = true;
		};
	});

	const parts = $derived(describeFilter(definition, filter, { entity: entity(), names }));

	function save(next: Filter) {
		onchange(next);
		unsaved = false;
		editing = false;
	}

	function cancel() {
		editing = false;
		if (unsaved) onremove();
	}

	function toRadius(value: unknown): RadiusValue | null {
		const v = value as Partial<RadiusValue> | null;
		return v &&
			typeof v === 'object' &&
			typeof v.latitude === 'number' &&
			typeof v.longitude === 'number' &&
			typeof v.radius === 'number'
			? (v as RadiusValue)
			: null;
	}

	function toPolygon(value: unknown): GeoJSON.Polygon | null {
		const v = value as GeoJSON.Polygon | null;
		return v && typeof v === 'object' && v.type === 'Polygon' ? v : null;
	}
</script>

<div class="rounded-lg border border-outline-subtle bg-surface shadow-sm select-none">
	<!-- The filter's name. On a phone it moves into the bar beside the grip instead. -->
	<div
		class="border-b border-outline-subtle px-4 py-1 text-xs font-semibold text-on-surface max-sm:hidden"
	>
		{definition.name}
	</div>
	<div
		class="flex flex-nowrap items-center gap-2 px-4 py-2 max-sm:flex-wrap max-sm:gap-y-1 max-sm:px-3"
	>
		{#if ondragstart}
			<DragHandle {ondragstart} {ondragend} />
		{/if}
		<span class="min-w-0 truncate text-sm font-semibold text-on-surface sm:hidden">
			{definition.name}
		</span>

		<!--
			On a phone the grip and buttons form a bar above, so the sentence gets the
			full width. A divider runs edge to edge between the two.
		-->
		<div
			class="flex min-w-0 flex-1 max-sm:order-last max-sm:-mx-3 max-sm:basis-[calc(100%+1.5rem)] max-sm:border-t max-sm:border-outline-subtle max-sm:px-3 max-sm:pt-1"
		>
			<FilterSentence {parts} onview={(kind) => (viewing = kind)} onedit={() => (editing = true)} />
		</div>

		<Button
			variant="ghost"
			size="sm"
			iconOnly
			class="shrink-0 max-sm:ml-auto"
			aria-label="Edit filter"
			onclick={() => (editing = true)}
		>
			<PencilSimpleIcon />
		</Button>
		<Button
			variant="ghost"
			size="sm"
			iconOnly
			class="shrink-0"
			aria-label="Remove filter"
			onclick={onremove}
		>
			<XIcon />
		</Button>
	</div>
</div>

<FilterEditModal
	open={editing}
	{definition}
	{filter}
	isNew={unsaved}
	onsave={save}
	oncancel={cancel}
/>

<!-- The map button on the sentence reopens the picker on what was chosen. -->
{#if definition.valueType === 'radius'}
	<RadiusPickerModal
		open={viewing === 'radius'}
		value={toRadius(filter.value)}
		onOpenChange={(next) => !next && (viewing = null)}
		onapply={(area) => {
			onchange({ ...filter, value: area });
			viewing = null;
		}}
	/>
{:else if definition.valueType === 'polygon'}
	<PolygonPickerModal
		open={viewing === 'polygon'}
		value={toPolygon(filter.value)}
		onOpenChange={(next) => !next && (viewing = null)}
		onapply={(region) => {
			onchange({ ...filter, value: region });
			viewing = null;
		}}
	/>
{/if}
