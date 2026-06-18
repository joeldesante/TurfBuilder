<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LocationDetailPage from './LocationDetailPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/LocationDetail',
		component: LocationDetailPage,
		tags: ['autodocs']
	});
</script>

<Story
	name="Named Location"
	args={{
		backHref: '/buckets/downtown/locations',
		location: {
			id: '1',
			name: 'City Hall',
			address_line_1: '100 Main St',
			address_line_2: null,
			address_line_3: null,
			city: 'Springfield',
			state_or_region: 'IL',
			postal_code: '62701',
			country_code: 'US',
			source: 'public'
		}
	}}
/>

<Story
	name="Address Only"
	args={{
		backHref: '/buckets/downtown/locations',
		location: {
			id: '2',
			name: null,
			address_line_1: '42 Oak Ave',
			address_line_2: 'Apt 3',
			address_line_3: null,
			city: 'Springfield',
			state_or_region: 'IL',
			postal_code: '62702',
			country_code: 'US',
			source: 'org'
		}
	}}
/>
