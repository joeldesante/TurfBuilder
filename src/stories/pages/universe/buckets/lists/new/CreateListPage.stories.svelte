<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CreateListPage from './CreateListPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/CreateList',
		component: CreateListPage,
		tags: ['autodocs']
	});
</script>

<Story
	name="People Only"
	args={{
		bucketName: 'Registered Voters',
		bucketFilter: {
			v: 1,
			people: { enabled: true, query: null },
			locations: { enabled: false, query: null }
		},
		onCreate: async () => {}
	}}
/>

<Story
	name="Locations Only"
	args={{
		bucketName: 'Downtown Properties',
		bucketFilter: {
			v: 1,
			people: { enabled: false, query: null },
			locations: { enabled: true, query: null }
		},
		onCreate: async () => {}
	}}
/>

<Story
	name="Both Types Available"
	args={{
		bucketName: 'Full Universe',
		bucketFilter: {
			v: 1,
			people: { enabled: true, query: null },
			locations: { enabled: true, query: null }
		},
		onCreate: async () => {}
	}}
/>
