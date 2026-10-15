<script lang="ts">
	import { Dialog } from 'bits-ui';
	import type { DateValue } from '@internationalized/date';
	import Button from '$components/actions/button/Button.svelte';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';
	import DatePicker from '$components/data-inputs/date-picker/DatePicker.svelte';
	import Dropdown from '$components/data-inputs/dropdown/Dropdown.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import ContactMadePicker from '$components/universe/contact-made-picker/ContactMadePicker.svelte';
	import FilterSentence from '$components/universe/filter-sentence/FilterSentence.svelte';
	import PolygonPickerModal from '$components/universe/polygon-picker-modal/PolygonPickerModal.svelte';
	import RadiusPickerModal from '$components/universe/radius-picker-modal/RadiusPickerModal.svelte';
	import SurveyResponsePicker from '$components/universe/survey-response-picker/SurveyResponsePicker.svelte';
	import {
		useFilterEntity,
		useFilterSource
	} from '$components/universe/filter-group/filter-source.svelte';
	import XIcon from 'phosphor-svelte/lib/X';
	import { filterSchema } from '$lib/shared/schemas/filters';
	import type { FilterRegistryEntry } from '$lib/shared/types/filter-registry';
	import type { Filter } from '$lib/shared/types/filters';
	import { describeFilter } from '$lib/shared/utils/filter-sentence';
	import {
		asCalendarDate,
		asContactMade,
		asPolygon,
		asRadius,
		asSurveyResponse
	} from '$lib/shared/utils/filter-values';
	import { FILTER_OPERATION_LABELS } from '$lib/shared/utils/filters';

	interface Props {
		open: boolean;
		definition: FilterRegistryEntry;
		/** The filter as it stands. The modal edits a copy; nothing changes until Save. */
		filter: Filter;
		/** A filter that has just been added and not yet saved once. */
		isNew?: boolean;
		onsave: (filter: Filter) => void;
		/** Closed without saving. */
		oncancel: () => void;
	}

	const { open, definition, filter, isNew = false, onsave, oncancel }: Props = $props();

	const uid = $props.id();
	const filterSource = useFilterSource();
	const entity = useFilterEntity();

	let draft = $state<Filter>({ item: '', operation: 'equals', value: '' });
	let radiusOpen = $state(false);
	let polygonOpen = $state(false);

	// Start from the saved filter each time the modal opens, so cancelling discards edits.
	$effect(() => {
		if (!open) return;
		const copy: Filter = structuredClone($state.snapshot(filter));
		// With nothing to choose between, the one operation is simply the filter's.
		if (definition.operations.length === 1) copy.operation = definition.operations[0];
		draft = copy;
	});

	const check = $derived(filterSchema.safeParse($state.snapshot(draft)));
	/** What is missing or wrong, in words, or null when the filter can be saved. */
	const problem = $derived(check.success ? null : (check.error.issues[0]?.message ?? 'Finish this filter'));

	const operationItems = $derived(
		definition.operations.map((operation) => ({
			value: operation,
			label: definition.operationLabels?.[operation] ?? FILTER_OPERATION_LABELS[operation]
		}))
	);

	const preview = $derived(describeFilter(definition, draft, { entity: entity() }));

	function setValue(value: unknown) {
		draft = { ...draft, value };
	}






	function save() {
		if (problem) return;
		onsave($state.snapshot(draft));
	}
</script>

<Dialog.Root {open} onOpenChange={(next) => !next && oncancel()}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<!-- preventOverflowTextSelection off: bits-ui would otherwise set user-select: text on the dialog while the mouse is down, overriding select-none. -->
		<Dialog.Content
			preventOverflowTextSelection={false}
			class="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface shadow-lg select-none [&_input]:select-text [&_textarea]:select-text"
		>
			<div class="flex items-start justify-between gap-4 border-b border-outline px-6 py-4">
				<div class="min-w-0">
					<Dialog.Title class="text-lg font-semibold text-on-surface">{definition.name}</Dialog.Title>
					<Dialog.Description class="text-sm text-on-surface-subtle">
						{definition.description}
					</Dialog.Description>
				</div>
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="sm" iconOnly aria-label="Close">
							<XIcon />
						</Button>
					{/snippet}
				</Dialog.Close>
			</div>

			<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
				<div class="rounded-lg bg-surface-container px-3 py-2" aria-label="Preview">
					<FilterSentence parts={preview} />
				</div>

				{#if operationItems.length > 1}
					<div class="flex flex-col gap-1.5">
						<span class="text-sm font-medium text-on-surface">Condition</span>
						<Dropdown
							class="self-start"
							aria-label="Operation"
							items={operationItems}
							value={draft.operation}
							onValueChange={(next) => (draft = { ...draft, operation: next as Filter['operation'] })}
						/>
					</div>
				{/if}

				<div class="flex flex-col gap-1.5">
					{#if definition.valueType === 'text'}
						<span class="text-sm font-medium text-on-surface">Text</span>
						<TextInput
							class="max-w-sm"
							aria-label="Value"
							value={String(draft.value ?? '')}
							oninput={(e: Event) => setValue((e.currentTarget as HTMLInputElement).value)}
						/>
						<Checkbox
							id="{uid}-case-sensitive"
							checked={draft.caseSensitive === true}
							onCheckedChange={(checked: boolean) => (draft = { ...draft, caseSensitive: checked })}
						>
							Case sensitive
						</Checkbox>
					{:else if definition.valueType === 'number'}
						<span class="text-sm font-medium text-on-surface">
							Number{definition.unit ? ` of ${definition.unit}` : ''}
						</span>
						<TextInput
							type="number"
							class="w-40"
							aria-label="Value"
							value={String(draft.value ?? '')}
							oninput={(e: Event) => {
								const raw = (e.currentTarget as HTMLInputElement).value;
								setValue(raw === '' ? '' : Number(raw));
							}}
						/>
					{:else if definition.valueType === 'date'}
						<span class="text-sm font-medium text-on-surface">Date</span>
						<DatePicker
							aria-label="Value"
							value={asCalendarDate(draft.value)}
							onValueChange={(next: DateValue | undefined) => setValue(next?.toString() ?? '')}
						/>
					{:else if definition.valueType === 'boolean'}
						<span class="text-sm font-medium text-on-surface">Which</span>
						<Dropdown
							class="self-start"
							aria-label="Value"
							items={[
								{ value: 'yes', label: definition.booleanLabels?.true ?? 'yes' },
								{ value: 'no', label: definition.booleanLabels?.false ?? 'no' }
							]}
							value={draft.value === true ? 'yes' : 'no'}
							onValueChange={(next) => setValue(next === 'yes')}
						/>
					{:else if definition.valueType === 'select'}
						<span class="text-sm font-medium text-on-surface">Choice</span>
						<Dropdown
							class="self-start"
							aria-label="Value"
							placeholder="Select..."
							items={definition.options ?? []}
							value={String(draft.value ?? '')}
							onValueChange={(next) => setValue(next)}
						/>
					{:else if definition.valueType === 'radius'}
						<span class="text-sm font-medium text-on-surface">Area</span>
						<Button
							variant="outline"
							weight="normal"
							class="self-start"
							aria-label="Value"
							onclick={() => (radiusOpen = true)}
						>
							{asRadius(draft.value) ? 'Edit area' : 'Choose area'}
						</Button>
						<RadiusPickerModal
							open={radiusOpen}
							value={asRadius(draft.value)}
							onOpenChange={(next) => (radiusOpen = next)}
							onapply={(area) => {
								setValue(area);
								radiusOpen = false;
							}}
						/>
					{:else if definition.valueType === 'polygon'}
						<span class="text-sm font-medium text-on-surface">Region</span>
						<Button
							variant="outline"
							weight="normal"
							class="self-start"
							aria-label="Value"
							onclick={() => (polygonOpen = true)}
						>
							{asPolygon(draft.value) ? 'Edit region' : 'Draw region'}
						</Button>
						<PolygonPickerModal
							open={polygonOpen}
							value={asPolygon(draft.value)}
							onOpenChange={(next) => (polygonOpen = next)}
							onapply={(region) => {
								setValue(region);
								polygonOpen = false;
							}}
						/>
					{:else if definition.valueType === 'survey_response'}
						<span class="text-sm font-medium text-on-surface">Survey question</span>
						{#if filterSource}
							<SurveyResponsePicker
								source={filterSource}
								value={asSurveyResponse(draft.value)}
								onchange={(next) => setValue(next)}
							/>
						{:else}
							<span class="text-sm text-on-surface-subtle">Survey choices are unavailable here.</span>
						{/if}
					{:else if definition.valueType === 'contact_made'}
						<span class="text-sm font-medium text-on-surface">Attempts</span>
						<ContactMadePicker
							source={filterSource}
							value={asContactMade(draft.value)}
							onchange={(next) => setValue(next)}
						/>
					{/if}
				</div>
			</div>

			<div class="flex items-center justify-between gap-4 border-t border-outline px-6 py-4">
				<p class="min-w-0 text-sm text-on-surface-subtle" role="status">{problem ?? ''}</p>
				<div class="flex shrink-0 gap-2">
					<Button variant="ghost" onclick={oncancel}>Cancel</Button>
					<Button disabled={problem !== null} onclick={save}>{isNew ? 'Add filter' : 'Save'}</Button>
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
