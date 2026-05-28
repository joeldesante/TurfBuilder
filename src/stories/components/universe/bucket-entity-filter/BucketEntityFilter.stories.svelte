<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BucketEntityFilter from './BucketEntityFilter.svelte';
	import type { FilterDefinition } from './BucketEntityFilter.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/BucketEntityFilter',
		component: BucketEntityFilter
	});

	const sampleFilters: FilterDefinition[] = [
		{
			id: 'last_canvassed',
			label: 'Last Time Canvassed',
			qualifiers: [
				{ value: 'after', label: 'was after' },
				{ value: 'before', label: 'was before' },
				{ value: 'not_after', label: 'was not after' },
				{ value: 'not_before', label: 'was not before' }
			],
			valueType: 'date'
		},
		{
			id: 'distance_from_address',
			label: 'Distance From Address',
			qualifiers: [
				{ value: 'within', label: 'is within' },
				{ value: 'not_within', label: 'is not within' }
			],
			valueType: 'number',
			valuePlaceholder: '0',
			valueUnit: 'miles'
		},
		{
			id: 'door_open_response',
			label: 'Survey Response: Door Open',
			qualifiers: [
				{ value: 'is', label: 'is' },
				{ value: 'is_not', label: 'is not' }
			],
			valueType: 'select',
			valueOptions: [
				{ value: 'yes', label: 'Yes' },
				{ value: 'no', label: 'No' },
				{ value: 'unknown', label: 'Unknown' }
			]
		},
		{
			id: 'support_level',
			label: 'Support Level',
			qualifiers: [
				{ value: 'is', label: 'is' },
				{ value: 'is_not', label: 'is not' },
				{ value: 'at_least', label: 'is at least' },
				{ value: 'at_most', label: 'is at most' }
			],
			valueType: 'select',
			valueOptions: [
				{ value: '1', label: 'Strong Support' },
				{ value: '2', label: 'Lean Support' },
				{ value: '3', label: 'Undecided' },
				{ value: '4', label: 'Lean Oppose' },
				{ value: '5', label: 'Strong Oppose' }
			]
		},
		{
			id: 'first_name',
			label: 'First Name',
			qualifiers: [
				{ value: 'is', label: 'is' },
				{ value: 'contains', label: 'contains' },
				{ value: 'starts_with', label: 'starts with' }
			],
			valueType: 'text',
			valuePlaceholder: 'Enter a name...'
		},
		{
			id: 'has_email',
			label: 'Has Email on File',
			valueType: 'none'
		}
	];
</script>

<!-- Default empty state — no filter chosen yet -->
<Story name="Empty">
	<BucketEntityFilter filters={sampleFilters} />
</Story>

<!-- Pre-selected: date filter -->
<Story name="Date Filter">
	<BucketEntityFilter
		filters={sampleFilters}
		filterId="last_canvassed"
		qualifierId="not_after"
		value="2024-01-01"
	/>
</Story>

<!-- Pre-selected: number + unit filter -->
<Story name="Number Filter with Unit">
	<BucketEntityFilter
		filters={sampleFilters}
		filterId="distance_from_address"
		qualifierId="within"
		value="5"
	/>
</Story>

<!-- Pre-selected: select value filter -->
<Story name="Select Value Filter">
	<BucketEntityFilter
		filters={sampleFilters}
		filterId="door_open_response"
		qualifierId="is"
		value="yes"
	/>
</Story>

<!-- Pre-selected: text filter -->
<Story name="Text Filter">
	<BucketEntityFilter
		filters={sampleFilters}
		filterId="first_name"
		qualifierId="starts_with"
		value="Mar"
	/>
</Story>

<!-- Filter with no qualifier and no value (boolean-style) -->
<Story name="No Qualifier No Value">
	<BucketEntityFilter filters={sampleFilters} filterId="has_email" />
</Story>

<!-- With remove callback -->
<Story name="With Remove Button">
	<BucketEntityFilter
		filters={sampleFilters}
		filterId="last_canvassed"
		qualifierId="after"
		value="2023-06-01"
		onremove={() => alert('remove clicked')}
	/>
</Story>
