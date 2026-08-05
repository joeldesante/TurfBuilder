<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TurfMapPage from './TurfMapPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Volunteer/TurfMapPage',
		component: TurfMapPage,
		parameters: { layout: 'fullscreen' }
	});

	const center = { lat: 39.9526, lng: -75.1652 };

	const locations = [
		{
			id: 'tl-1',
			location_name: 'Rosa Deli',
			visited: false,
			contact_made: null,
			latitude: 39.9526,
			longitude: -75.1652,
			street: '123 Main St',
			locality: 'Philadelphia',
			postcode: '19104',
			region: 'PA',
			country: 'US'
		},
		{
			id: 'tl-2',
			location_name: 'Corner Barbershop',
			visited: true,
			contact_made: true,
			latitude: 39.9541,
			longitude: -75.1601,
			street: '87 Market St',
			locality: 'Philadelphia',
			postcode: '19104',
			region: 'PA',
			country: 'US'
		},
		{
			id: 'tl-3',
			location_name: 'Lucky Laundromat',
			visited: true,
			contact_made: false,
			latitude: 39.9498,
			longitude: -75.1688,
			street: '412 Pine St',
			locality: 'Philadelphia',
			postcode: '19104',
			region: 'PA',
			country: 'US'
		}
	];
</script>

<Story name="Default" args={{ orgSlug: 'acme', turfId: 'turf-1', locations, center }} />

<Story
	name="Single Location"
	args={{ orgSlug: 'acme', turfId: 'turf-1', locations: [locations[0]], center }}
/>

<!-- A turf with nothing on it yet: the map falls back to the turf centroid. -->
<Story name="Empty Turf" args={{ orgSlug: 'acme', turfId: 'turf-1', locations: [], center }} />
