<script lang="ts">
	import { parseDate } from '@internationalized/date';
	import type { DateValue } from '@internationalized/date';
	import Button from '$components/actions/button/Button.svelte';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';
	import DatePicker from '$components/data-inputs/date-picker/DatePicker.svelte';
	import Dropdown from '$components/data-inputs/dropdown/Dropdown.svelte';
	import Switch from '$components/data-inputs/switch/Switch.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import DragHandle from '$components/universe/drag-handle/DragHandle.svelte';
	import XIcon from 'phosphor-svelte/lib/X';
	import PolygonPickerModal from '$components/universe/polygon-picker-modal/PolygonPickerModal.svelte';
	import RadiusPickerModal from '$components/universe/radius-picker-modal/RadiusPickerModal.svelte';
	import type { Filter, RadiusValue } from '$lib/shared/types/filters';
	import type { FilterRegistryEntry } from '$lib/shared/types/filter-registry';
	import { FILTER_OPERATION_LABELS } from '$lib/shared/utils/filters';

	interface Props {
		/** The registry entry this row edits; decides the operations and the value input. */
		definition: FilterRegistryEntry;
		filter: Filter;
		onchange: (filter: Filter) => void;
		onremove: () => void;
		/** When given, a grip is shown on the left that starts a drag to reorder the filter. */
		ondragstart?: (event: DragEvent) => void;
		ondragend?: (event: DragEvent) => void;
	}

	const { definition, filter, onchange, onremove, ondragstart, ondragend }: Props = $props();

	const uid = $props.id();

	const operationItems = $derived(
		definition.operations.map((operation) => ({
			value: operation,
			label: FILTER_OPERATION_LABELS[operation]
		}))
	);

	function setValue(value: unknown) {
		onchange({ ...filter, value });
	}

	let radiusOpen = $state(false);
	let polygonOpen = $state(false);

	function toPolygon(value: unknown): GeoJSON.Polygon | null {
		const v = value as GeoJSON.Polygon | null;
		return v && typeof v === 'object' && v.type === 'Polygon' ? v : null;
	}

	function toRadius(value: unknown): RadiusValue | null {
		const v = value as Partial<RadiusValue> | null;
		return v && typeof v === 'object' && typeof v.latitude === 'number' && typeof v.longitude === 'number' && typeof v.radius === 'number'
			? (v as RadiusValue)
			: null;
	}

	function toDate(value: unknown): DateValue | undefined {
		if (typeof value !== 'string' || !value) return undefined;
		try {
			return parseDate(value);
		} catch {
			return undefined;
		}
	}
</script>

<div class="flex flex-nowrap items-center gap-2 rounded-lg border border-outline-subtle bg-surface px-4 py-2 shadow-sm">
	{#if ondragstart}
		<DragHandle {ondragstart} {ondragend} />
	{/if}
	<span class="min-w-32 shrink-0 text-sm font-medium text-on-surface">{definition.name}</span>

	<Dropdown
		class="shrink-0"
		aria-label="Operation"
		items={operationItems}
		value={filter.operation}
		onValueChange={(next) => onchange({ ...filter, operation: next as Filter['operation'] })}
	/>

	{#if definition.valueType === 'text'}
		<TextInput
			class="w-48"
			aria-label="Value"
			value={String(filter.value ?? '')}
			oninput={(e: Event) => setValue((e.currentTarget as HTMLInputElement).value)}
		/>
		<Checkbox
			id="{uid}-case-sensitive"
			checked={filter.caseSensitive === true}
			onCheckedChange={(checked: boolean) => onchange({ ...filter, caseSensitive: checked })}
		>
			Case sensitive
		</Checkbox>
	{:else if definition.valueType === 'number'}
		<TextInput
			type="number"
			class="w-32"
			aria-label="Value"
			value={String(filter.value ?? '')}
			oninput={(e: Event) => {
				const raw = (e.currentTarget as HTMLInputElement).value;
				setValue(raw === '' ? '' : Number(raw));
			}}
		/>
	{:else if definition.valueType === 'date'}
		<DatePicker
			aria-label="Value"
			value={toDate(filter.value)}
			onValueChange={(next: DateValue | undefined) => setValue(next?.toString() ?? '')}
		/>
	{:else if definition.valueType === 'boolean'}
		<Switch
			aria-label="Value"
			checked={filter.value === true}
			onCheckedChange={(checked: boolean) => setValue(checked)}
		/>
	{:else if definition.valueType === 'select'}
		<Dropdown
			class="shrink-0"
			aria-label="Value"
			placeholder="Select..."
			items={definition.options ?? []}
			value={String(filter.value ?? '')}
			onValueChange={(next) => setValue(next)}
		/>
	{:else if definition.valueType === 'radius'}
		<Button
			variant="outline"
			weight="normal"
			class="shrink-0 whitespace-nowrap"
			aria-label="Value"
			onclick={() => (radiusOpen = true)}
		>
			{toRadius(filter.value) ? 'View / Edit area' : 'Choose area'}
		</Button>
		<RadiusPickerModal
			open={radiusOpen}
			value={toRadius(filter.value)}
			onOpenChange={(next) => (radiusOpen = next)}
			onapply={(area) => {
				setValue(area);
				radiusOpen = false;
			}}
		/>
	{:else if definition.valueType === 'polygon'}
<Button
			variant="outline"
			weight="normal"
			class="shrink-0 whitespace-nowrap"
			aria-label="Value"
			onclick={() => (polygonOpen = true)}
		>
			{toPolygon(filter.value) ? 'Edit area' : 'Draw area'}
		</Button>
		{#if toPolygon(filter.value)}
			<span class="text-sm text-on-surface-subtle">Region drawn</span>
		{/if}
		<PolygonPickerModal
			open={polygonOpen}
			value={toPolygon(filter.value)}
			onOpenChange={(next) => (polygonOpen = next)}
			onapply={(region) => {
				setValue(region);
				polygonOpen = false;
			}}
		/>
	{/if}

	{#if definition.unit && definition.valueType !== 'radius'}
		<span class="text-sm text-on-surface-subtle">{definition.unit}</span>
	{/if}

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
