<script lang="ts">
	import { untrack } from 'svelte';
	import Button from '$components/actions/button/Button.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import EntityFilterEditor from '$components/universe/entity-filter-editor/EntityFilterEditor.svelte';
	import type { FilterSource } from '$lib/client/filter-source';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { createListFormSchema } from '$lib/shared/schemas/lists';
	import type { FilterEntity, FilterGroup } from '$lib/shared/types/filters';
	import { filtersFor } from '$lib/shared/utils/filter-registry';
	import { SELECTABLE_ENTITIES } from '$lib/shared/utils/filters';

	export interface CreateListPayload {
		name: string;
		entity_type: FilterEntity;
		expires_at: string;
		/** What the list narrows the bucket down to. Empty takes the whole bucket. */
		filters: FilterGroup;
	}

	interface Props {
		bucketName: string;
		/** Which kinds of record the bucket includes. */
		bucketFilter: { people: { enabled: boolean }; locations: { enabled: boolean } };
		/** The organization whose buckets, lists, and surveys the filters offer. */
		orgId?: string;
		/** Overrides where those choices come from; for stories and tests. */
		source?: FilterSource;
		onCreate: (payload: CreateListPayload) => Promise<void>;
	}

	const { bucketName, bucketFilter, orgId, source, onCreate }: Props = $props();

	const availableTypes = $derived(
		(['people', 'locations'] as const).filter(
			(type) => bucketFilter[type].enabled && SELECTABLE_ENTITIES.includes(type)
		)
	);

	// Pre-select the only available type when there is exactly one. Read once:
	// it sets the starting choice and should not follow later prop changes.
	const defaultType = untrack((): FilterEntity | '' =>
		availableTypes.length === 1 ? availableTypes[0] : ''
	);

	const form = new Form(
		createListFormSchema,
		async (values) => {
			const entityType = availableTypes.find((type) => type === values.entityType);
			if (!entityType) throw new Error('Choose a kind of record');
			await onCreate({
				name: values.name,
				entity_type: entityType,
				expires_at: new Date(values.expiresAt).toISOString(),
				filters: values.filters
			});
		},
		{ entityType: defaultType, filters: { operator: 'AND', filters: [] } }
	);

	// Filters for one kind of record do not apply to the other, so start over when the kind changes.
	$effect(() => {
		if (form.values.entityType) {
			untrack(() => (form.values.filters = { operator: 'AND', filters: [] }));
		}
	});

	const selectedType = $derived(availableTypes.find((type) => type === form.values.entityType));

	// The filter editor's problems are reported under several paths (filters, filters.filters.0...).
	// Show the first one once the user has tried to submit.
	const filtersError = $derived(
		Object.entries(form.errors).find(
			([path]) => (path === 'filters' || path.startsWith('filters.')) && form.touched[path]
		)?.[1][0]
	);
</script>

<div>
	<PageHeader title="New List" subheading={bucketName} />

	<div class="flex flex-col gap-6">
		<p class="text-sm text-on-surface-subtle">
			Create a snapshot of records from this bucket matching the filters below.
			The filters are applied once at creation time — the list stores references
			to the exact records that match right now.
		</p>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				form.submit();
			}}
			novalidate
			class="flex flex-col gap-6"
		>
			<FormField
				label="Name"
				id="list-name"
				errors={form.errors.name ?? []}
				dirty={!!form.touched.name}
			>
				<TextInput
					bind:value={form.values.name}
					onfocusout={() => form.touch('name')}
					placeholder="e.g. Ward 3 Doors"
					class="w-full max-w-sm"
				/>
			</FormField>

			<FormField
				label="Expiration Date"
				id="list-expires"
				errors={form.errors.expiresAt ?? []}
				dirty={!!form.touched.expiresAt}
			>
				<TextInput
					type="date"
					bind:value={form.values.expiresAt}
					onfocusout={() => form.touch('expiresAt')}
					class="w-full max-w-sm"
				/>
			</FormField>

			<!-- Entity type selection -->
			<div class="flex flex-col gap-2">
				<span class="text-sm font-medium">Entity Type</span>
				<div class="flex flex-row gap-6">
					{#each availableTypes as type (type)}
						<label class="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								name="entity-type"
								value={type}
								bind:group={form.values.entityType}
								aria-label={type === 'people' ? 'People' : 'Locations'}
							/>
							<span class="text-sm">{type === 'people' ? 'People' : 'Locations'}</span>
						</label>
					{/each}
				</div>
				{#if form.touched.entityType && form.errors.entityType}
					<p class="text-sm text-error" role="alert">{form.errors.entityType[0]}</p>
				{/if}
			</div>
		</form>

		<!-- Filter editor — only shown once an entity type is selected -->
		{#if selectedType}
			<!-- Keyed, because the editor takes its kind of record when it is created. -->
			{#key selectedType}
				<EntityFilterEditor
					label="This list will contain"
					entity={selectedType}
					catalog={filtersFor(selectedType)}
					{orgId}
					{source}
					bind:group={form.values.filters}
				/>
			{/key}
		{/if}

		<!-- Error -->
		{#if filtersError}
			<p class="text-sm text-error" role="alert">{filtersError}</p>
		{/if}

		{#if form.errorMessage}
			<p class="text-sm text-error" role="alert">{form.errorMessage}</p>
		{/if}

		<!-- Submit -->
		<div>
			<Button onclick={() => form.submit()} loading={form.submitting}>
				{form.submitting ? 'Creating...' : 'Create List'}
			</Button>
		</div>
	</div>
</div>
