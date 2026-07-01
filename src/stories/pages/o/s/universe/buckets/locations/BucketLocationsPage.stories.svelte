<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BucketLocationsPage from './BucketLocationsPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Buckets/Locations',
		component: BucketLocationsPage,
		tags: ['autodocs']
	});
</script>

<Story
	name="With Results"
	args={{
		bucketName: 'Downtown District',
		enabled: true,
		locations: [
			{ id: '1', name: 'City Hall', address_line_1: '100 Main St', address_line_2: null, city: 'Springfield', state_or_region: 'IL', postal_code: '62701' },
			{ id: '2', name: null, address_line_1: '42 Oak Ave', address_line_2: 'Apt 3', city: 'Springfield', state_or_region: 'IL', postal_code: '62702' },
			{ id: '3', name: 'Community Center', address_line_1: '200 Elm St', address_line_2: null, city: 'Shelbyville', state_or_region: 'IL', postal_code: '62565' }
		]
	}}
/>

<Story
	name="Empty Results"
	args={{
		bucketName: 'Downtown District',
		enabled: true,
		locations: []
	}}
/>

<Story
	name="Not Enabled"
	args={{
		bucketName: 'People Only',
		enabled: false,
		locations: []
	}}
/>
