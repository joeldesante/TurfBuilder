<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FilterQueryDemo from './FilterQueryDemo.svelte';

	const { Story } = defineMeta({
		title: 'Demos/Filter Query',
		component: FilterQueryDemo,
		parameters: { layout: 'fullscreen' }
	});
</script>

<Story name="Empty" />

<Story
	name="Nested Locations"
	args={{
		entity: 'locations',
		group: {
			operator: 'AND',
			filters: [
				{ item: 'city', operation: 'contains', value: 'phil' },
				{
					operator: 'OR',
					filters: [
						{ item: 'state', operation: 'equals', value: 'NJ' },
						{ item: 'zip_code', operation: 'starts_with', value: '191' }
					]
				}
			]
		}
	}}
/>

<Story
	name="People"
	args={{
		entity: 'people',
		group: {
			operator: 'AND',
			filters: [
				{ item: 'age', operation: 'greater_than', value: 65 },
				{ item: 'has_email', operation: 'equals', value: true }
			]
		}
	}}
/>

<Story
	name="Radius"
	args={{
		entity: 'locations',
		group: {
			operator: 'AND',
			filters: [
				{
					item: 'radius_from_point',
					operation: 'within',
					value: { latitude: 39.95, longitude: -75.16, radius: 3 }
				}
			]
		}
	}}
/>

<Story
	name="Latest Contact In A Date Range"
	args={{
		entity: 'locations',
		group: {
			operator: 'AND',
			filters: [
				{
					item: 'contact_made',
					operation: 'equals',
					value: {
						contacted: false,
						position: 'latest',
						n: null,
						bucketId: null,
						listId: null,
						from: '2026-01-01',
						to: '2026-01-31'
					}
				}
			]
		}
	}}
/>

<Story
	name="Incomplete Filter"
	args={{
		entity: 'locations',
		group: { operator: 'AND', filters: [{ item: 'city', operation: 'equals', value: '' }] }
	}}
/>

<Story
	name="Filter For The Wrong Entity"
	args={{
		entity: 'people',
		group: { operator: 'AND', filters: [{ item: 'city', operation: 'equals', value: 'Austin' }] }
	}}
/>
