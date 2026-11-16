<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimple';
	import XIcon from 'phosphor-svelte/lib/X';
	import {
		CONTACT_SCHEMA_FIELD_TYPES,
		CONTACT_SCHEMA_FIELD_TYPE_LABELS,
		type ContactSchema,
		type ContactSchemaField,
		type ContactSchemaFieldType
	} from '$lib/shared/types/contact-schemas';

	interface SchemaInput {
		schema_name: string;
		/** Every field, in order. An existing field keeps its id when renamed. */
		fields: ContactSchemaField[];
		/** The id of the text field that labels a contact. Null is the full address. */
		identifier_field_id: string | null;
	}

	interface Props {
		schemas: ContactSchema[];
		onCreate: (input: SchemaInput) => Promise<void>;
		onUpdate: (id: string, input: SchemaInput) => Promise<void>;
		onDelete: (id: string) => Promise<void>;
	}

	const { schemas, onCreate, onUpdate, onDelete }: Props = $props();

	interface Row {
		/** The field's id. New fields get one here, so the save can say which field the identifier is. */
		id: string;
		name: string;
		type: ContactSchemaFieldType;
		required: boolean;
		/** The type of a field that contacts already hold values for cannot change. */
		typeLocked: boolean;
	}

	/** `null` closed, `'new'` creating, otherwise the id being edited. */
	let editing = $state<string | null>(null);
	let name = $state('');
	let rows = $state<Row[]>([]);
	/** Id of the field chosen as the identifier, or '' for the full address. */
	let identifier = $state('');
	let saving = $state(false);
	let formError = $state<string | null>(null);
	let deletingId = $state<string | null>(null);

	function open(schema?: ContactSchema) {
		editing = schema ? schema.id : 'new';
		name = schema?.schema_name ?? '';
		const locked = (schema?.contact_count ?? 0) > 0;
		rows = schema ? schema.fields.map((field) => ({ ...field, typeLocked: locked })) : [newRow()];
		identifier = schema?.identifier_field_id ?? '';
		formError = null;
	}

	function newRow(): Row {
		return { id: crypto.randomUUID(), name: '', type: 'text', required: false, typeLocked: false };
	}

	function close() {
		editing = null;
		formError = null;
	}

	function addRow() {
		rows.push(newRow());
	}

	/** The fields that can be the identifier: named text fields. */
	const identifierOptions = $derived(rows.filter((r) => r.type === 'text' && r.name.trim()));
	/** The chosen identifier, or '' once its field is gone or no longer text. */
	const activeIdentifier = $derived(
		identifierOptions.some((r) => r.id === identifier) ? identifier : ''
	);

	/** The identifier is always required, so its box stays ticked and cannot be changed. */
	const isIdentifier = (row: Row) => row.id === activeIdentifier;

	function removeRow(index: number) {
		rows.splice(index, 1);
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		formError = null;

		const fields: ContactSchemaField[] = [];
		const seen = new Set<string>();
		for (const row of rows) {
			const fieldName = row.name.trim();
			if (!fieldName) {
				formError = 'Every field needs a name.';
				return;
			}
			// Names are compared without regard to case, so "Name" and "name" clash.
			if (seen.has(fieldName.toLowerCase())) {
				formError = `The field "${fieldName}" is listed twice. Field names must be different.`;
				return;
			}
			seen.add(fieldName.toLowerCase());
			// The identifier is always required, whatever its box says.
			fields.push({
				id: row.id,
				name: fieldName,
				type: row.type,
				required: row.required || isIdentifier(row)
			});
		}
		if (!name.trim()) {
			formError = 'Enter a name for the schema.';
			return;
		}

		saving = true;
		try {
			const input = {
				schema_name: name.trim(),
				fields,
				identifier_field_id: activeIdentifier || null
			};
			if (editing === 'new') await onCreate(input);
			else await onUpdate(editing!, input);
			close();
		} catch (e) {
			formError = e instanceof Error ? e.message : 'The schema could not be saved.';
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		deletingId = id;
		try {
			await onDelete(id);
		} finally {
			deletingId = null;
		}
	}

	function usage(count: number): string {
		return count === 0 ? 'Not used' : `${count} ${count === 1 ? 'contact' : 'contacts'}`;
	}

	const inputClass =
		'w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface';
</script>

<PageHeader
	title="Contact schemas"
	subheading="Define the fields a contact's details can hold and the type each one expects."
>
	{#snippet actions()}
		{#if editing === null}
			<Button onclick={() => open()}><PlusIcon /> New schema</Button>
		{/if}
	{/snippet}
</PageHeader>

<div class="p-6 space-y-6 max-w-3xl">
	{#if editing !== null}
		<form
			class="rounded-lg border border-outline p-4 space-y-4"
			onsubmit={save}
			aria-label={editing === 'new' ? 'New schema' : 'Edit schema'}
		>
			<div class="space-y-1">
				<label for="schema-name" class="text-sm font-medium text-on-surface">Schema name</label>
				<input id="schema-name" class={inputClass} bind:value={name} maxlength="255" />
			</div>

			<fieldset class="space-y-2">
				<legend class="text-sm font-medium text-on-surface">Fields</legend>
				{#each rows as row, index (row.id)}
					<div class="flex items-center gap-2">
						<input
							class={inputClass}
							placeholder="Field name"
							aria-label="Field name {index + 1}"
							bind:value={row.name}
							maxlength="100"
						/>
						<select
							class="{inputClass} max-w-40"
							aria-label="Type of field {index + 1}"
							title={row.typeLocked
								? 'Contacts already hold values for this field, so its type cannot change.'
								: undefined}
							disabled={row.typeLocked}
							bind:value={row.type}
						>
							{#each CONTACT_SCHEMA_FIELD_TYPES as type (type)}
								<option value={type}>{CONTACT_SCHEMA_FIELD_TYPE_LABELS[type]}</option>
							{/each}
						</select>
						<div class="flex items-center gap-1.5 whitespace-nowrap text-sm text-on-surface">
							<Checkbox
								aria-label="Field {index + 1} is required"
								checked={row.required || isIdentifier(row)}
								disabled={isIdentifier(row)}
								onCheckedChange={(checked) => (row.required = checked)}
							/>
							Required
						</div>
						<Button
							variant="ghost"
							size="sm"
							iconOnly
							aria-label="Remove field {index + 1}"
							onclick={() => removeRow(index)}
						>
							<XIcon />
						</Button>
					</div>
				{/each}
				<Button variant="outline" size="sm" onclick={addRow}><PlusIcon /> Add field</Button>
			</fieldset>

			<div class="space-y-1">
				<label for="schema-identifier" class="text-sm font-medium text-on-surface">
					Identifier
				</label>
				<select id="schema-identifier" class={inputClass} bind:value={identifier}>
					<option value="">Full address (default)</option>
					{#each identifierOptions as option (option.id)}
						<option value={option.id}>{option.name.trim()}</option>
					{/each}
				</select>
				<p class="text-xs text-on-surface-subtle">
					The text field that labels a contact. It is always required. Without one, a contact is
					labelled by its address, or its coordinates when it has no address.
				</p>
			</div>

			{#if formError}
				<p class="text-sm text-error" role="alert">{formError}</p>
			{/if}

			<div class="flex gap-2">
				<Button type="submit" loading={saving}>Save</Button>
				<Button variant="ghost" onclick={close}>Cancel</Button>
			</div>
		</form>
	{/if}

	{#if schemas.length === 0}
		<p class="text-sm text-on-surface-subtle">No contact schemas yet.</p>
	{:else}
		<div class="rounded-lg border border-outline overflow-hidden">
			<table class="w-full text-sm">
				<thead class="bg-surface-container text-on-surface-subtle text-left">
					<tr>
						<th class="px-4 py-3 font-medium">Schema</th>
						<th class="px-4 py-3 font-medium">Fields</th>
						<th class="px-4 py-3 font-medium">Identifier</th>
						<th class="px-4 py-3 font-medium">In use</th>
						<th class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-outline">
					{#each schemas as schema (schema.id)}
						<tr>
							<td class="px-4 py-3 font-medium text-on-surface">{schema.schema_name}</td>
							<td class="px-4 py-3 text-on-surface-subtle">
								{#each schema.fields as field, i (field.id)}
									{i > 0 ? ', ' : ''}{field.name} ({CONTACT_SCHEMA_FIELD_TYPE_LABELS[
										field.type
									]}{field.required ? ', required' : ''})
								{:else}
									None
								{/each}
							</td>
							<td class="px-4 py-3 text-on-surface-subtle">
								{schema.fields.find((f) => f.id === schema.identifier_field_id)?.name ??
									'Full address'}
							</td>
							<td class="px-4 py-3 text-on-surface-subtle">{usage(schema.contact_count)}</td>
							<td class="px-4 py-3 text-right whitespace-nowrap">
								<Button
									variant="ghost"
									size="sm"
									iconOnly
									aria-label="Edit {schema.schema_name}"
									onclick={() => open(schema)}
								>
									<PencilSimpleIcon />
								</Button>
								<Button
									variant="ghost"
									size="sm"
									iconOnly
									aria-label="Delete {schema.schema_name}"
									title={schema.contact_count > 0
										? 'Used by contacts, so it cannot be deleted.'
										: undefined}
									disabled={schema.contact_count > 0}
									loading={deletingId === schema.id}
									onclick={() => remove(schema.id)}
								>
									<TrashIcon />
								</Button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
