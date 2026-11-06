<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import BucketFiltersEditor from '$components/universe/bucket-filters-editor/BucketFiltersEditor.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import type { FilterSource } from '$lib/client/filter-source';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { createBucketFormSchema } from '$lib/shared/schemas/buckets';
	import { slugFromName } from '$lib/shared/utils/slug';
	import type { BucketFilters } from '$lib/shared/types/filters';

	interface Props {
		/** The organization whose buckets, lists, and surveys the filters offer. */
		orgId?: string;
		/** Overrides where those choices come from; for stories and tests. */
		source?: FilterSource;
		onCreate: (name: string, slug: string, filters: BucketFilters) => Promise<void>;
	}

	const { orgId, source, onCreate }: Props = $props();

	const form = new Form(
		createBucketFormSchema,
		async (values) => {
			await onCreate(values.name, slugFromName(values.name), values.filters);
		},
		{ filters: { v: 2, people: null, locations: null } }
	);

	const slug = $derived(slugFromName(form.values.name));

	// The filter editor's problems are reported under several paths (filters, filters.locations...).
	// Show the first one once the user has tried to submit.
	const filtersError = $derived(
		Object.entries(form.errors).find(
			([path]) => (path === 'filters' || path.startsWith('filters.')) && form.touched[path]
		)?.[1][0]
	);
</script>

<div>
	<PageHeader title="Create a Bucket" />

	<div class="flex flex-col gap-6">
		<p>Filter down your data set for this bucket.</p>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				form.submit();
			}}
			novalidate
			class="flex flex-col gap-1"
		>
			<FormField
				label="Name"
				id="bucket-name"
				errors={form.errors.name ?? []}
				dirty={!!form.touched.name}
			>
				<TextInput
					bind:value={form.values.name}
					onfocusout={() => form.touch('name')}
					placeholder="e.g. Registered Voters"
					class="w-full max-w-sm"
				/>
			</FormField>
			{#if slug}
				<p class="text-xs text-on-surface-subtle">Slug: <span class="font-mono">{slug}</span></p>
			{/if}
		</form>

		<BucketFiltersEditor bind:filters={form.values.filters} {orgId} {source} />

		{#if filtersError}
			<p class="text-sm text-error" role="alert">{filtersError}</p>
		{/if}

		{#if form.errorMessage}
			<p class="text-sm text-error" role="alert">{form.errorMessage}</p>
		{/if}

		<div>
			<Button onclick={() => form.submit()} loading={form.submitting}>
				{form.submitting ? 'Creating...' : 'Create Bucket'}
			</Button>
		</div>
	</div>
</div>
