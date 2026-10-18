<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FilterSentence from './FilterSentence.svelte';
	import { describeFilter } from '$lib/shared/utils/filter-sentence';
	import { getFilter } from '$lib/shared/utils/filter-registry';

	const say = (item: string, operation: string, value: unknown) =>
		describeFilter(
			getFilter(item)!,
			{ item, operation: operation as never, value },
			{ entity: 'people' }
		);

	const { Story } = defineMeta({
		title: 'Components/Universe/FilterSentence',
		component: FilterSentence,
		args: { onview: () => {} }
	});
</script>

<Story name="Text" args={{ parts: say('city', 'contains', 'phil') }} />
<Story
	name="Radius"
	args={{ parts: say('radius_from_point', 'within', { latitude: 39.95, longitude: -75.16, radius: 2 }) }}
/>
<Story name="Not Set Yet" args={{ parts: say('city', 'equals', '') }} />
<Story
	name="Too Long For One Line"
	args={{
		parts: say('contact_made', 'equals', {
			contacted: false,
			position: 'nth_from_last',
			n: 3,
			bucketId: '11111111-1111-4111-8111-111111111111',
			listId: null,
			from: '2026-01-01',
			to: '2026-01-31'
		})
	}}
/>
<Story
	name="On A Phone"
	globals={{ viewport: { value: 'mobile1', isRotated: false } }}
	args={{
		parts: say('contact_made', 'equals', {
			contacted: false,
			position: 'latest',
			n: null,
			bucketId: '11111111-1111-4111-8111-111111111111',
			listId: '44444444-4444-4444-8444-444444444444',
			from: '2026-01-01',
			to: '2026-01-31'
		})
	}}
/>
