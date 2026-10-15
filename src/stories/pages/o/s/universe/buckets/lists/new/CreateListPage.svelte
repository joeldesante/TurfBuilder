<script lang="ts">
	import { untrack } from 'svelte';
	import Button from '$components/actions/button/Button.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import EntityFilterEditor from '$components/universe/entity-filter-editor/EntityFilterEditor.svelte';
	import type { FilterSource } from '$lib/client/filter-source';
	import { filterGroupSchema } from '$lib/shared/schemas/filters';
	import type { FilterEntity, FilterGroup } from '$lib/shared/types/filters';
	import { filtersFor } from '$lib/shared/utils/filter-registry';

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
		(['people', 'locations'] as const).filter((type) => bucketFilter[type].enabled)
	);

	let name = $state('');
	let expiresAt = $state('');

	// Pre-select the only available type when there is exactly one. Read once:
	// it sets the starting choice and should not follow later prop changes.
	const defaultType = untrack((): FilterEntity | null =>
		bucketFilter.people.enabled && !bucketFilter.locations.enabled
			? 'people'
			: !bucketFilter.people.enabled && bucketFilter.locations.enabled
				? 'locations'
				: null
	);

	let selectedType = $state<FilterEntity | null>(defaultType);
	let group = $state<FilterGroup>({ operator: 'AND', filters: [] });
	let submitting = $state(false);
	let errorMessage = $state('');

	// Filters for one kind of record do not apply to the other, so start over when the kind changes.
	$effect(() => {
		if (selectedType) untrack(() => (group = { operator: 'AND', filters: [] }));
	});

	const canSubmit = $derived(
		name.trim().length > 0 && expiresAt.length > 0 && selectedType !== null && !submitting
	);

	async function handleSubmit() {
		if (!canSubmit || !selectedType) return;
		errorMessage = '';

		const checked = filterGroupSchema.safeParse($state.snapshot(group));
		if (!checked.success) {
			errorMessage = checked.error.issues[0]?.message ?? 'Finish the filters before creating the list.';
			return;
		}

		submitting = true;
		try {
			await onCreate({
				name: name.trim(),
				entity_type: selectedType,
				expires_at: new Date(expiresAt).toISOString(),
				filters: checked.data
			});
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
		} finally {
			submitting = false;
		}
	}
</script>

<div>
	<PageHeader title="New List" subheading={bucketName} />

	<div class="flex flex-col gap-6">
		<p class="text-sm text-on-surface-subtle">
			Create a snapshot of records from this bucket matching the filters below.
			The filters are applied once at creation time — the list stores references
			to the exact records that match right now.
		</p>

		<!-- Name -->
		<div class="flex flex-col gap-1">
			<label for="list-name" class="text-sm font-medium">Name</label>
			<input
				id="list-name"
				type="text"
				bind:value={name}
				placeholder="e.g. Ward 3 Doors"
				aria-label="Name"
				class="border rounded px-3 py-2 w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-primary"
			/>
		</div>

		<!-- Expiration date -->
		<div class="flex flex-col gap-1">
			<label for="list-expires" class="text-sm font-medium">Expiration Date</label>
			<input
				id="list-expires"
				type="date"
				bind:value={expiresAt}
				aria-label="Expiration Date"
				class="border rounded px-3 py-2 w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-primary"
			/>
		</div>

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
							bind:group={selectedType}
							aria-label={type === 'people' ? 'People' : 'Locations'}
						/>
						<span class="text-sm">{type === 'people' ? 'People' : 'Locations'}</span>
					</label>
				{/each}
			</div>
		</div>

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
					bind:group
				/>
			{/key}
		{/if}

		<!-- Error -->
		{#if errorMessage}
			<p class="text-sm text-error">{errorMessage}</p>
		{/if}

		<!-- Submit -->
		<div>
			<Button onclick={handleSubmit} disabled={!canSubmit}>
				{submitting ? 'Creating...' : 'Create List'}
			</Button>
		</div>
	</div>
</div>
