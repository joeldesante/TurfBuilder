<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ContactMadePicker from './ContactMadePicker.svelte';
	import { defaultContactMade } from '$lib/shared/utils/filter-registry';
	import type { FilterSource } from '$lib/client/filter-source';

	const BUCKET = '11111111-1111-4111-8111-111111111111';
	const LIST = '44444444-4444-4444-8444-444444444444';

	const source: FilterSource = {
		listBuckets: async () => [{ id: BUCKET, name: 'Philadelphia voters' }],
		listLists: async () => [{ id: LIST, name: 'Ward 3 doors', entity_type: 'locations' }],
		listSurveys: async () => [],
		listQuestions: async () => []
	};

	const { Story } = defineMeta({
		title: 'Components/Universe/ContactMadePicker',
		component: ContactMadePicker,
		args: { source, value: defaultContactMade(), onchange: () => {} }
	});
</script>

<Story name="Any Attempt" />
<Story name="Latest Attempt" args={{ value: { ...defaultContactMade(), position: 'latest' } }} />
<Story
	name="Third From Last"
	args={{ value: { ...defaultContactMade(), position: 'nth_from_last', n: 3 } }}
/>
<Story
	name="Scoped To A List And Dates"
	args={{
		value: {
			...defaultContactMade(),
			contacted: false,
			position: 'latest',
			bucketId: BUCKET,
			listId: LIST,
			from: '2026-01-01',
			to: '2026-01-31'
		}
	}}
/>
<Story name="Without Bucket Choices" args={{ source: undefined }} />
