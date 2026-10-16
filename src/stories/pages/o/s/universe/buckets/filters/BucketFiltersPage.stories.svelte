<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BucketFiltersPage from './BucketFiltersPage.svelte';
	import type { FilterSource } from '$lib/client/filter-source';

	const source: FilterSource = {
		listBuckets: async () => [{ id: '11111111-1111-4111-8111-111111111111', name: 'Philadelphia voters' }],
		listLists: async () => [],
		listSurveys: async () => [],
		listQuestions: async () => []
	};

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Buckets/Filters',
		component: BucketFiltersPage,
		tags: ['autodocs'],
		args: { bucketName: 'Registered Voters', source, onSave: async () => {} }
	});
</script>

<Story
	name="Locations With Filters"
	args={{
		filters: {
			v: 2,
			people: null,
			locations: {
				operator: 'AND',
				filters: [
					{ item: 'city', operation: 'equals', value: 'Philadelphia' },
					{
						operator: 'OR',
						not: true,
						filters: [{ item: 'zip_code', operation: 'starts_with', value: '191' }]
					}
				]
			}
		}
	}}
/>
<Story
	name="People And Locations"
	args={{
		filters: {
			v: 2,
			people: { operator: 'AND', filters: [{ item: 'age', operation: 'greater_than', value: 65 }] },
			locations: { operator: 'AND', filters: [] }
		}
	}}
/>
<Story name="Nothing Included" args={{ filters: { v: 2, people: null, locations: null } }} />
