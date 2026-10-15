<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Button from '$components/actions/button/Button.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import BucketFiltersEditor from '$components/universe/bucket-filters-editor/BucketFiltersEditor.svelte';
	import type { FilterSource } from '$lib/client/filter-source';
	import { bucketFiltersSchema } from '$lib/shared/schemas/filters';
	import type { BucketFilters } from '$lib/shared/types/filters';

	interface Props {
		bucketName: string;
		/**
		 * What the bucket selects as it is saved, or null when its old filter could not be
		 * converted, in which case `problem` says why and the filters start empty.
		 */
		filters: BucketFilters | null;
		problem?: string | null;
		/** The organization whose buckets, lists, and surveys the filters offer. */
		orgId?: string;
		/** Overrides where those choices come from; for stories and tests. */
		source?: FilterSource;
		/** Saves the filters. Reject with a message fit to show the user. */
		onSave: (filters: BucketFilters) => Promise<void>;
	}

	const { bucketName, filters, problem: unconverted = null, orgId, source, onSave }: Props = $props();

	const EMPTY: BucketFilters = { v: 2, people: null, locations: null };

	const copy = (value: BucketFilters): BucketFilters => JSON.parse(JSON.stringify(value));

	// The page edits a copy. `saved` is what the bucket holds, so it moves only when a save goes through.
	// A bucket that could not be converted starts empty, and counts as changed until it is saved.
	let saved = $state(untrack(() => copy(filters ?? EMPTY)));
	let draft = $state(untrack(() => copy(filters ?? EMPTY)));
	let converted = $state(untrack(() => filters !== null));
	let saving = $state(false);

	const dirty = $derived(
		!converted || JSON.stringify($state.snapshot(draft)) !== JSON.stringify($state.snapshot(saved))
	);
	const check = $derived(bucketFiltersSchema.safeParse($state.snapshot(draft)));
	const problem = $derived(check.success ? null : (check.error.issues[0]?.message ?? 'Finish the filters first.'));

	async function save() {
		if (!dirty || problem || saving) return;
		saving = true;
		try {
			const next = copy($state.snapshot(draft));
			await onSave(next);
			saved = next;
			converted = true;
			toast.success('Filters saved.');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'The filters could not be saved.');
		} finally {
			saving = false;
		}
	}

	function discard() {
		draft = copy($state.snapshot(saved));
	}

	const canDiscard = $derived(
		JSON.stringify($state.snapshot(draft)) !== JSON.stringify($state.snapshot(saved))
	);
</script>

<div>
	<PageHeader title="Filters" subheading={bucketName} />

	<div class="flex flex-col gap-6">
		{#if !converted}
			<div
				role="alert"
				class="rounded-lg border border-error bg-error-container p-3 text-sm text-on-error-container"
			>
				<p class="font-medium">This bucket's old filters could not be converted.</p>
				<p>{unconverted}</p>
				<p>Build its filters again below. Nothing is selected until you save.</p>
			</div>
		{/if}

		<p class="text-sm text-on-surface-subtle">
			These filters decide which records are in this bucket. Changes apply to the bucket straight
			away. Lists already made from it are snapshots and do not change.
		</p>

		<BucketFiltersEditor bind:filters={draft} {orgId} {source} />

		<div class="flex items-center gap-3">
			<Button onclick={save} disabled={!dirty || problem !== null || saving} loading={saving}>
				Save Filters
			</Button>
			<Button variant="ghost" onclick={discard} disabled={!canDiscard || saving}>Discard Changes</Button>
			{#if problem && dirty}
				<span class="text-sm text-on-surface-subtle" role="status">{problem}</span>
			{:else if dirty}
				<span class="text-sm text-on-surface-subtle" role="status">Unsaved changes</span>
			{/if}
		</div>
	</div>
</div>
