<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import UniverseDataLocationsPage from './UniverseDataLocationsPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Staff/UniverseDataLocationsPage',
		component: UniverseDataLocationsPage,
		args: {
			orgSlug: 'acme',
			onCreate: async () => {},
			onUpdate: async () => {},
			onDelete: async () => {}
		}
	});

	const locations = [
		{
			id: 'v-1',
			entity_id: 'e-1',
			name: 'Rosa Deli',
			address_line_1: '123 Main St',
			address_line_2: null,
			city: 'Philadelphia',
			state_or_region: 'PA',
			postal_code: '19104',
			country_code: 'US',
			latitude: 39.9526,
			longitude: -75.1652,
			photo_keys: [],
			suggestion_status: null
		},
		{
			id: 'v-2',
			entity_id: 'e-2',
			name: 'Corner Barbershop',
			address_line_1: '87 Market St',
			address_line_2: null,
			city: 'Philadelphia',
			state_or_region: 'PA',
			postal_code: '19104',
			country_code: 'US',
			latitude: 39.9541,
			longitude: -75.1601,
			photo_keys: [],
			suggestion_status: null
		},
		{
			id: 'v-3',
			entity_id: 'e-3',
			name: 'Lucky Laundromat',
			address_line_1: '412 Pine St',
			address_line_2: null,
			city: 'Philadelphia',
			state_or_region: 'PA',
			postal_code: '19104',
			country_code: 'US',
			latitude: 39.9498,
			longitude: -75.1688,
			photo_keys: [],
			suggestion_status: 'tentative'
		}
	];
</script>

<Story
	name="Default"
	args={{
		locations,
		totalCount: 3,
		canCreate: true,
		canUpdate: true,
		canDelete: true
	}}
/>

<!-- A member with read-only access sees no add or delete affordances. -->
<Story name="Read Only" args={{ locations, totalCount: 3 }} />

<Story name="Empty" args={{ locations: [], totalCount: 0, canCreate: true }} />

<Story name="Truncated" args={{ locations, totalCount: 4820, canCreate: true, canDelete: true }} />
