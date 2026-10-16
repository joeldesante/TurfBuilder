<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CreateListPage from './CreateListPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Buckets/Lists/New',
		component: CreateListPage,
		tags: ['autodocs']
	});
</script>

<Story
	name="People Only"
	args={{
		bucketName: 'Registered Voters',
		bucketFilter: {
			people: { enabled: true },
			locations: { enabled: false }
		},
		onCreate: async () => {}
	}}
/>

<Story
	name="Locations Only"
	args={{
		bucketName: 'Downtown Properties',
		bucketFilter: {
			people: { enabled: false },
			locations: { enabled: true }
		},
		onCreate: async () => {}
	}}
/>

<Story
	name="Both Types Available"
	args={{
		bucketName: 'Full Universe',
		bucketFilter: {
			people: { enabled: true },
			locations: { enabled: true }
		},
		onCreate: async () => {}
	}}
/>
