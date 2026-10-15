<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import EntityFilterEditor from '$components/universe/entity-filter-editor/EntityFilterEditor.svelte';
	import type { FilterSource } from '$lib/client/filter-source';
	import { bucketFiltersSchema } from '$lib/shared/schemas/filters';
	import type { BucketFilters, FilterGroup } from '$lib/shared/types/filters';
	import { filtersFor } from '$lib/shared/utils/filter-registry';

	interface Props {
		/** The organization whose buckets, lists, and surveys the filters offer. */
		orgId?: string;
		/** Overrides where those choices come from; for stories and tests. */
		source?: FilterSource;
		onCreate: (name: string, slug: string, filters: BucketFilters) => Promise<void>;
	}

	const { orgId, source, onCreate }: Props = $props();

	let name = $state('');
	let submitting = $state(false);
	let errorMessage = $state('');

	const slug = $derived(
		name
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
	);

	let includePeople = $state(false);
	let includeLocations = $state(false);

	// Kept while a kind is unticked, so ticking it again brings its filters back.
	let peopleGroup = $state<FilterGroup>({ operator: 'AND', filters: [] });
	let locationsGroup = $state<FilterGroup>({ operator: 'AND', filters: [] });

	const canSubmit = $derived(!!slug && (includePeople || includeLocations) && !submitting);

	async function handleSubmit() {
		if (!canSubmit) return;
		errorMessage = '';

		const filters: BucketFilters = {
			v: 2,
			people: includePeople ? $state.snapshot(peopleGroup) : null,
			locations: includeLocations ? $state.snapshot(locationsGroup) : null
		};
		const checked = bucketFiltersSchema.safeParse(filters);
		if (!checked.success) {
			errorMessage = checked.error.issues[0]?.message ?? 'Finish the filters before creating the bucket.';
			return;
		}

		submitting = true;
		try {
			await onCreate(name.trim(), slug, checked.data);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
		} finally {
			submitting = false;
		}
	}
</script>

<div>
	<PageHeader title="Create a Bucket" />

	<div class="flex flex-col gap-6">
		<p>Filter down your data set for this bucket.</p>

		<div class="flex flex-col gap-1">
			<label for="bucket-name" class="text-sm font-medium">Name</label>
			<input
				id="bucket-name"
				type="text"
				bind:value={name}
				placeholder="e.g. Registered Voters"
				aria-label="Name"
				class="border rounded px-3 py-2 w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-primary"
			/>
			{#if slug}
				<p class="text-xs text-on-surface-subtle">Slug: <span class="font-mono">{slug}</span></p>
			{/if}
		</div>

		<div class="border rounded p-4">
			<h2>What entities would you like to include in this bucket?</h2>
			<div class="flex flex-row gap-6 my-2">
				<Checkbox id="entity-people" bind:checked={includePeople}>People</Checkbox>
				<Checkbox id="entity-locations" bind:checked={includeLocations}>Locations</Checkbox>
			</div>
		</div>

		{#if includePeople}
			<section class="flex flex-col gap-2" aria-label="People filters">
				<h2 class="text-sm font-medium">People</h2>
				<EntityFilterEditor
					label="This bucket will contain"
					entity="people"
					catalog={filtersFor('people')}
					{orgId}
					{source}
					bind:group={peopleGroup}
				/>
			</section>
		{/if}

		{#if includeLocations}
			<section class="flex flex-col gap-2" aria-label="Locations filters">
				<h2 class="text-sm font-medium">Locations</h2>
				<EntityFilterEditor
					label="This bucket will contain"
					entity="locations"
					catalog={filtersFor('locations')}
					{orgId}
					{source}
					bind:group={locationsGroup}
				/>
			</section>
		{/if}

		{#if errorMessage}
			<p class="text-sm text-error">{errorMessage}</p>
		{/if}

		<div>
			<Button onclick={handleSubmit} disabled={!canSubmit}>
				{submitting ? 'Creating...' : 'Create Bucket'}
			</Button>
		</div>
	</div>
</div>
