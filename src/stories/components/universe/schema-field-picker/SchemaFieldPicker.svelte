<script lang="ts">
	import Dropdown from '$components/data-inputs/dropdown/Dropdown.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import { loadOptions } from '$lib/client/filter-source';
	import type { FilterSource } from '$lib/client/filter-source';
	import type { ContactSchema, ContactSchemaFieldType } from '$lib/shared/types/contact-schemas';
	import type { SchemaFieldValue } from '$lib/shared/types/filters';

	interface Props {
		/** Where the organization's contact schemas, with their fields, come from. */
		source: FilterSource;
		/** The current choice; null until a schema is picked. */
		value: SchemaFieldValue | null;
		onchange: (value: SchemaFieldValue) => void;
		/** Tells the editor what kind of field is chosen, since that decides how it can be compared. Null when none is. */
		ontypechange?: (type: ContactSchemaFieldType | null) => void;
	}

	const { source, value, onchange, ontypechange }: Props = $props();

	let schemas = $state<ContactSchema[]>([]);
	let failed = $state(false);

	const schemaId = $derived(value?.schemaId ?? '');
	const fieldId = $derived(value?.fieldId ?? '');
	const schema = $derived(schemas.find((s) => s.id === schemaId));
	const field = $derived(schema?.fields.find((f) => f.id === fieldId));
	const loaded = $derived(schemas.length > 0 || failed);

	$effect(() =>
		loadOptions(
			() => source.listSchemas?.() ?? Promise.resolve([]),
			(rows) => (schemas = rows),
			(next) => (failed = next)
		)
	);

	// Whatever the chosen field is, the editor needs its type to offer the right comparisons.
	$effect(() => {
		ontypechange?.(field?.type ?? null);
	});

	/** What a field's value starts as: nothing yet for text and numbers, and yes for true/false. */
	function startingValue(type: ContactSchemaFieldType): SchemaFieldValue['value'] {
		return type === 'text' ? '' : type === 'boolean' ? true : null;
	}

	function chooseSchema(next: string) {
		onchange({ schemaId: next, fieldId: '', value: null });
	}

	function chooseField(next: string) {
		const type = schema?.fields.find((f) => f.id === next)?.type ?? 'text';
		onchange({ schemaId, fieldId: next, value: startingValue(type) });
	}

	function setValue(next: SchemaFieldValue['value']) {
		onchange({ schemaId, fieldId, value: next });
	}
</script>

<div class="flex min-w-0 flex-wrap items-center gap-2">
	<Dropdown
		class="min-w-0 max-w-56"
		aria-label="Schema"
		placeholder="Choose schema"
		items={schemas.map((s) => ({ value: s.id, label: s.schema_name }))}
		value={schemaId}
		onValueChange={chooseSchema}
	/>

	{#if schemaId && schema}
		<Dropdown
			class="min-w-0 max-w-56"
			aria-label="Field"
			placeholder="Choose field"
			items={schema.fields.map((f) => ({ value: f.id, label: f.name }))}
			value={fieldId}
			onValueChange={chooseField}
		/>
	{/if}

	{#if field}
		{#if field.type === 'text'}
			<TextInput
				class="w-56"
				aria-label="Value"
				placeholder="Text to compare"
				value={typeof value?.value === 'string' ? value.value : ''}
				oninput={(e: Event) => setValue((e.currentTarget as HTMLInputElement).value)}
			/>
		{:else if field.type === 'number'}
			<TextInput
				type="number"
				class="w-40"
				aria-label="Value"
				value={typeof value?.value === 'number' ? String(value.value) : ''}
				oninput={(e: Event) => {
					const raw = (e.currentTarget as HTMLInputElement).value;
					setValue(raw === '' ? null : Number(raw));
				}}
			/>
		{:else}
			<Dropdown
				class="self-start"
				aria-label="Value"
				items={[
					{ value: 'yes', label: 'yes' },
					{ value: 'no', label: 'no' }
				]}
				value={value?.value === false ? 'no' : 'yes'}
				onValueChange={(next) => setValue(next === 'yes')}
			/>
		{/if}
	{/if}
</div>

{#if failed}
	<p class="mt-2 text-sm text-error" role="alert">The schemas could not be loaded.</p>
{:else if loaded && schemaId && !schema}
	<p class="mt-2 text-sm text-error" role="alert">
		This schema no longer exists, so this filter matches nothing. Choose another.
	</p>
{:else if schema && fieldId && !field}
	<p class="mt-2 text-sm text-error" role="alert">
		This field no longer exists, so this filter matches nothing. Choose another.
	</p>
{/if}
