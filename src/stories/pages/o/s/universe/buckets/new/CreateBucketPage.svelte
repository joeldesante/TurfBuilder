<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import BucketEntityFilterEditor from '$components/universe/bucket-entity-filter-editor/BucketEntityFilterEditor.svelte';
	import type { FilterDefinition } from '$components/universe/bucket-entity-filter/BucketEntityFilter.svelte';
	import type { FilterEntry } from '$components/universe/bucket-entity-filter-editor/BucketEntityFilterEditor.svelte';
	import type { BucketFilterInput, MatchType } from '$lib/server/filter-converter';

	interface Props {
		onCreate: (name: string, slug: string, filter: BucketFilterInput) => Promise<void>;
	}

	const { onCreate }: Props = $props();

	// ---------------------------------------------------------------------------
	// Name + slug
	// ---------------------------------------------------------------------------

	let name = $state('');
	let submitting = $state(false);
	let errorMessage = $state('');

	let slug = $derived(
		name
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
	);

	// ---------------------------------------------------------------------------
	// Entity toggles
	// ---------------------------------------------------------------------------

	let includePeople = $state(false);
	let includeLocations = $state(false);

	// ---------------------------------------------------------------------------
	// People filter state
	// ---------------------------------------------------------------------------

	let peopleMatchType = $state<MatchType>('ONE_OR_MORE');
	let peopleFilterEntries = $state<FilterEntry[]>([]);

	const peopleFilters: FilterDefinition[] = [
		{
			id: 'first_name',
			label: 'First Name',
			qualifiers: [
				{ value: 'is', label: 'is' },
				{ value: 'is_not', label: 'is not' },
				{ value: 'contains', label: 'contains' },
				{ value: 'starts_with', label: 'starts with' }
			],
			valueType: 'text',
			valuePlaceholder: 'Enter a name...'
		},
		{
			id: 'last_name',
			label: 'Last Name',
			qualifiers: [
				{ value: 'is', label: 'is' },
				{ value: 'is_not', label: 'is not' },
				{ value: 'contains', label: 'contains' },
				{ value: 'starts_with', label: 'starts with' }
			],
			valueType: 'text',
			valuePlaceholder: 'Enter a name...'
		},
		{
			id: 'age',
			label: 'Age',
			qualifiers: [
				{ value: 'eq', label: 'is exactly' },
				{ value: 'gt', label: 'is greater than' },
				{ value: 'lt', label: 'is less than' },
				{ value: 'gte', label: 'is at least' },
				{ value: 'lte', label: 'is at most' }
			],
			valueType: 'number',
			valuePlaceholder: '0',
			valueUnit: 'years'
		},
		{
			id: 'dob',
			label: 'Date of Birth',
			qualifiers: [
				{ value: 'after', label: 'is after' },
				{ value: 'before', label: 'is before' },
				{ value: 'not_after', label: 'is on or before' },
				{ value: 'not_before', label: 'is on or after' }
			],
			valueType: 'date'
		},
		{
			id: 'has_email',
			label: 'Has Email on File',
			valueType: 'none'
		},
		{
			id: 'has_phone',
			label: 'Has Phone on File',
			valueType: 'none'
		}
	];

	// ---------------------------------------------------------------------------
	// Location filter state
	// ---------------------------------------------------------------------------

	let locationsMatchType = $state<MatchType>('ONE_OR_MORE');
	let locationsFilterEntries = $state<FilterEntry[]>([]);

	const locationFilters: FilterDefinition[] = [
		{
			id: 'city',
			label: 'City',
			qualifiers: [
				{ value: 'is', label: 'is' },
				{ value: 'is_not', label: 'is not' },
				{ value: 'contains', label: 'contains' }
			],
			valueType: 'text',
			valuePlaceholder: 'Enter a city...'
		},
		{
			id: 'state',
			label: 'State',
			qualifiers: [
				{ value: 'is', label: 'is' },
				{ value: 'is_not', label: 'is not' }
			],
			valueType: 'text',
			valuePlaceholder: 'e.g. CA'
		},
		{
			id: 'zip_code',
			label: 'ZIP Code',
			qualifiers: [
				{ value: 'is', label: 'is' },
				{ value: 'is_not', label: 'is not' },
				{ value: 'starts_with', label: 'starts with' }
			],
			valueType: 'text',
			valuePlaceholder: 'e.g. 90210'
		}
	];

	// ---------------------------------------------------------------------------
	// Submit
	// ---------------------------------------------------------------------------

	async function handleSubmit() {
		if (!slug || submitting) return;
		submitting = true;
		errorMessage = '';
		try {
			const filter: BucketFilterInput = {
				people: {
					enabled: includePeople,
					matchType: peopleMatchType,
					conditions: peopleFilterEntries.map((e) => ({
						filterId: e.filterId,
						qualifierId: e.qualifierId,
						value: e.value
					}))
				},
				locations: {
					enabled: includeLocations,
					matchType: locationsMatchType,
					conditions: locationsFilterEntries.map((e) => ({
						filterId: e.filterId,
						qualifierId: e.qualifierId,
						value: e.value
					}))
				}
			};
			await onCreate(name.trim(), slug, filter);
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

		<!-- Name field -->
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

		<!-- Entity selection -->
		<div class="border rounded p-4">
			<h2>What entities would you like to include in this bucket?</h2>
			<div class="flex flex-row gap-6 my-2">
				<Checkbox id="entity-people" bind:checked={includePeople}>People</Checkbox>
				<Checkbox id="entity-locations" bind:checked={includeLocations}>Locations</Checkbox>
			</div>
		</div>

		<!-- Filter editors -->
		<div class="flex flex-col gap-4">
			{#if includePeople}
				<BucketEntityFilterEditor
					entity="People"
					filters={peopleFilters}
					bind:matchType={peopleMatchType}
					bind:filterEntries={peopleFilterEntries}
				/>
			{/if}

			{#if includeLocations}
				<BucketEntityFilterEditor
					entity="Locations"
					filters={locationFilters}
					bind:matchType={locationsMatchType}
					bind:filterEntries={locationsFilterEntries}
				/>
			{/if}
		</div>

		<!-- Error message -->
		{#if errorMessage}
			<p class="text-sm text-error">{errorMessage}</p>
		{/if}

		<!-- Submit -->
		<div>
			<Button onclick={handleSubmit} disabled={!slug || submitting}>
				{submitting ? 'Creating...' : 'Create Bucket'}
			</Button>
		</div>
	</div>
</div>
