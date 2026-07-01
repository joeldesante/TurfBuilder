<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import BucketEntityFilterEditor from '$components/universe/bucket-entity-filter-editor/BucketEntityFilterEditor.svelte';
	import type { FilterDefinition } from '$components/universe/bucket-entity-filter/BucketEntityFilter.svelte';
	import type { FilterEntry } from '$components/universe/bucket-entity-filter-editor/BucketEntityFilterEditor.svelte';
	import type { StoredBucketFilter, MatchType, FilterCondition } from '$lib/server/filter-converter';
	import { untrack } from 'svelte';

	interface CreateListPayload {
		name: string;
		entity_type: 'people' | 'locations';
		expires_at: string;
		filter: {
			matchType: MatchType;
			conditions: FilterCondition[];
		};
	}

	interface Props {
		bucketName: string;
		bucketFilter: StoredBucketFilter;
		onCreate: (payload: CreateListPayload) => Promise<void>;
	}

	const { bucketName, bucketFilter, onCreate }: Props = $props();

	// ---------------------------------------------------------------------------
	// Available entity types (derived from what the bucket includes)
	// ---------------------------------------------------------------------------

	const availableTypes = $derived(
		[
			bucketFilter.people.enabled ? ('people' as const) : null,
			bucketFilter.locations.enabled ? ('locations' as const) : null
		].filter((t): t is 'people' | 'locations' => t !== null)
	);

	// ---------------------------------------------------------------------------
	// Form state
	// ---------------------------------------------------------------------------

	let name = $state('');
	let expiresAt = $state('');

	// Pre-select the only available type when there is exactly one.
	// untrack is used intentionally: we only want the initial prop value to set
	// the default — this should not re-run if bucketFilter changes after mount.
	const defaultType = untrack((): 'people' | 'locations' | null =>
		bucketFilter.people.enabled && !bucketFilter.locations.enabled
			? 'people'
			: !bucketFilter.people.enabled && bucketFilter.locations.enabled
				? 'locations'
				: null
	);

	let selectedType = $state<'people' | 'locations' | null>(defaultType);
	let submitting = $state(false);
	let errorMessage = $state('');

	// ---------------------------------------------------------------------------
	// Filter state
	// ---------------------------------------------------------------------------

	let matchType = $state<MatchType>('ONE_OR_MORE');
	let filterEntries = $state<FilterEntry[]>([]);

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

	const activeFilters = $derived(selectedType === 'people' ? peopleFilters : locationFilters);

	// Reset filter entries when entity type changes.
	$effect(() => {
		if (selectedType) {
			filterEntries = [];
			matchType = 'ONE_OR_MORE';
		}
	});

	// ---------------------------------------------------------------------------
	// Submit
	// ---------------------------------------------------------------------------

	const canSubmit = $derived(
		name.trim().length > 0 && expiresAt.length > 0 && selectedType !== null && !submitting
	);

	async function handleSubmit() {
		if (!canSubmit || !selectedType) return;
		submitting = true;
		errorMessage = '';
		try {
			await onCreate({
				name: name.trim(),
				entity_type: selectedType,
				expires_at: new Date(expiresAt).toISOString(),
				filter: {
					matchType,
					conditions: filterEntries.map((e) => ({
						filterId: e.filterId,
						qualifierId: e.qualifierId,
						value: e.value
					}))
				}
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
				{#each availableTypes as type}
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
			<BucketEntityFilterEditor
				entity={selectedType === 'people' ? 'People' : 'Locations'}
				filters={activeFilters}
				bind:matchType
				bind:filterEntries
			/>
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
