<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BucketListsPage from './BucketListsPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Buckets/Lists',
		component: BucketListsPage,
		tags: ['autodocs']
	});
</script>

<Story
	name="Empty"
	args={{
		bucketName: 'Registered Voters',
		bucketSlug: 'registered-voters',
		orgSlug: 'test-org',
		lists: [],
		createHref: '/o/test-org/s/universe/buckets/registered-voters/lists/new'
	}}
/>

<Story
	name="With Lists"
	args={{
		bucketName: 'Registered Voters',
		bucketSlug: 'registered-voters',
		orgSlug: 'test-org',
		lists: [
			{
				id: '1',
				name: 'Ward 3 Doors',
				entity_type: 'people',
				expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
				created_at: new Date().toISOString(),
				entry_count: 142
			},
			{
				id: '2',
				name: 'Downtown Canvass',
				entity_type: 'locations',
				expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
				created_at: new Date().toISOString(),
				entry_count: 58
			}
		],
		createHref: '/o/test-org/s/universe/buckets/registered-voters/lists/new'
	}}
/>

<Story
	name="With Expired"
	args={{
		bucketName: 'Registered Voters',
		bucketSlug: 'registered-voters',
		orgSlug: 'test-org',
		lists: [
			{
				id: '1',
				name: 'Ward 3 Doors',
				entity_type: 'people',
				expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
				created_at: new Date().toISOString(),
				entry_count: 142
			},
			{
				id: '2',
				name: 'Old Spring Drive',
				entity_type: 'people',
				expires_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
				created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
				entry_count: 87
			}
		],
		createHref: '/o/test-org/s/universe/buckets/registered-voters/lists/new'
	}}
/>
