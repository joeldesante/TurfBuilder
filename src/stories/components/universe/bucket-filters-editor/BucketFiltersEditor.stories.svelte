<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BucketFiltersEditor from './BucketFiltersEditor.svelte';
	import type { FilterSource } from '$lib/client/filter-source';

	// Stands in for the API so the filters that name a bucket or survey have choices.
	const source: FilterSource = {
		listBuckets: async () => [{ id: '11111111-1111-4111-8111-111111111111', name: 'Philadelphia voters' }],
		listLists: async () => [],
		listSurveys: async () => [],
		listQuestions: async () => []
	};

	const { Story } = defineMeta({
		title: 'Components/Universe/BucketFiltersEditor',
		component: BucketFiltersEditor,
		args: { source }
	});
</script>

<Story name="Nothing Included" args={{ filters: { v: 2, people: null, locations: null } }} />
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
					{ item: 'zip_code', operation: 'starts_with', value: '191' }
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
