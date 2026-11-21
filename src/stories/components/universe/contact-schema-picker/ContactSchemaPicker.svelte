<script lang="ts">
	import Dropdown from '$components/data-inputs/dropdown/Dropdown.svelte';
	import { loadOptions } from '$lib/client/filter-source';
	import type { FilterSource } from '$lib/client/filter-source';
	import type { ContactSchema } from '$lib/shared/types/contact-schemas';
	import type { ContactSchemaValue } from '$lib/shared/types/filters';

	interface Props {
		/** Where the organization's contact schemas come from. */
		source: FilterSource;
		/** The current choice; null until a schema is picked. */
		value: ContactSchemaValue | null;
		onchange: (value: ContactSchemaValue) => void;
	}

	const { source, value, onchange }: Props = $props();

	let schemas = $state<ContactSchema[]>([]);
	let failed = $state(false);

	const schemaId = $derived(value?.schemaId ?? '');
	/** A schema that was chosen and has since been deleted is still shown, so it can be seen and replaced. */
	const missing = $derived(schemaId !== '' && !schemas.some((s) => s.id === schemaId));

	$effect(() =>
		loadOptions(
			() => source.listSchemas?.() ?? Promise.resolve([]),
			(rows) => (schemas = rows),
			(next) => (failed = next)
		)
	);
</script>

<div class="flex min-w-0 flex-wrap items-center gap-2">
	<Dropdown
		class="min-w-0 max-w-64"
		aria-label="Schema"
		placeholder="Choose schema"
		items={schemas.map((s) => ({ value: s.id, label: s.schema_name }))}
		value={schemaId}
		onValueChange={(next) => onchange({ schemaId: next })}
	/>
	{#if failed}
		<span class="text-sm text-error" role="alert">The schemas could not be loaded.</span>
	{:else if missing && schemas.length > 0}
		<span class="text-sm text-error" role="alert">
			This schema no longer exists, so this filter matches nothing. Choose another.
		</span>
	{/if}
</div>
