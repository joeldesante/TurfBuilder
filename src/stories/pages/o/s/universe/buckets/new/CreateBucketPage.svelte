<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import BucketFiltersEditor from '$components/universe/bucket-filters-editor/BucketFiltersEditor.svelte';
	import type { FilterSource } from '$lib/client/filter-source';
	import { bucketFiltersSchema } from '$lib/shared/schemas/filters';
	import type { BucketFilters } from '$lib/shared/types/filters';

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

	let filters = $state<BucketFilters>({ v: 2, people: null, locations: null });

	const canSubmit = $derived(
		!!slug && (filters.people !== null || filters.locations !== null) && !submitting
	);

	async function handleSubmit() {
		if (!canSubmit) return;
		errorMessage = '';

		const checked = bucketFiltersSchema.safeParse($state.snapshot(filters));
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

		<BucketFiltersEditor bind:filters {orgId} {source} />

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
