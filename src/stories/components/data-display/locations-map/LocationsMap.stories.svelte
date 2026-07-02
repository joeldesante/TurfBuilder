<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LocationsMap from './LocationsMap.svelte';

	const { Story } = defineMeta({
		title: 'Components/DataDisplay/LocationsMap',
		component: LocationsMap,
		tags: ['autodocs']
	});

	const sampleLocations = [
		{
			id: 'loc-1',
			name: 'Community Center',
			address_line_1: '100 Main St',
			city: 'Philadelphia',
			latitude: 40.0259,
			longitude: -75.2238
		},
		{
			id: 'loc-2',
			name: 'Public Library',
			address_line_1: '250 Market St',
			city: 'Philadelphia',
			latitude: 40.031,
			longitude: -75.218
		},
		{
			id: 'loc-3',
			name: null,
			address_line_1: '87 Elm Ave',
			city: 'Philadelphia',
			latitude: 40.021,
			longitude: -75.229
		}
	];
</script>

<Story name="Default" args={{ locations: sampleLocations, class: 'w-full h-[480px]' }} />

<Story name="Empty" args={{ locations: [], class: 'w-full h-[480px]' }} />

<Story
	name="Loading Locations"
	args={{ locations: [], locationsLoading: true, class: 'w-full h-[480px]' }}
/>
