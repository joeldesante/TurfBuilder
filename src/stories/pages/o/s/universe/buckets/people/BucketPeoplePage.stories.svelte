<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BucketPeoplePage from './BucketPeoplePage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Buckets/People',
		component: BucketPeoplePage,
		tags: ['autodocs']
	});
</script>

<Story
	name="With Results"
	args={{
		bucketName: 'Registered Voters',
		enabled: true,
		people: [
			{ id: '1', first_name: 'Alice', last_name: 'Johnson', email: 'alice@example.com', phone: '555-0101', dob: '1985-04-12' },
			{ id: '2', first_name: 'Bob', last_name: 'Smith', email: null, phone: '555-0102', dob: '1972-11-30' },
			{ id: '3', first_name: null, last_name: 'Garcia', email: 'garcia@example.com', phone: null, dob: null }
		]
	}}
/>

<Story
	name="Empty Results"
	args={{
		bucketName: 'Registered Voters',
		enabled: true,
		people: []
	}}
/>

<Story
	name="Not Enabled"
	args={{
		bucketName: 'Locations Only',
		enabled: false,
		people: []
	}}
/>
