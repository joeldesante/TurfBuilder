<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ListDetailPage from './ListDetailPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Buckets/Lists/Detail',
		component: ListDetailPage,
		tags: ['autodocs']
	});
</script>

<Story
	name="People List"
	args={{
		orgSlug: 'test-org',
		bucketName: 'Registered Voters',
		bucketSlug: 'registered-voters',
		listHref: '/o/test-org/s/universe/buckets/registered-voters/lists/1',
		list: {
			id: '1',
			name: 'Ward 3 Doors',
			entity_type: 'people',
			expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
			created_at: new Date().toISOString()
		},
		entries: [
			{ record_id: 'a', record_source: 'org_person', entity_id: 'ent-a', first_name: 'Alice', last_name: 'Nguyen', email: 'alice@example.com', phone: '555-1234' },
			{ record_id: 'b', record_source: 'org_person', entity_id: 'ent-b', first_name: 'Bob', last_name: 'Smith', email: null, phone: '555-5678' },
			{ record_id: 'c', record_source: 'public_person', entity_id: 'ent-c', first_name: 'Carol', last_name: 'Lee', email: 'carol@example.com', phone: null }
		],
		turfs: []
	}}
/>

<Story
	name="Locations List"
	args={{
		orgSlug: 'test-org',
		bucketName: 'Downtown Properties',
		bucketSlug: 'downtown-properties',
		listHref: '/o/test-org/s/universe/buckets/downtown-properties/lists/2',
		list: {
			id: '2',
			name: 'Main St Block',
			entity_type: 'locations',
			expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
			created_at: new Date().toISOString()
		},
		entries: [
			{ record_id: 'x', record_source: 'org_location', entity_id: 'ent-x', name: 'City Hall', address_line_1: '100 Main St', city: 'Springfield', state_or_region: 'IL', postal_code: '62701' },
			{ record_id: 'y', record_source: 'org_location', entity_id: 'ent-y', name: null, address_line_1: '200 Oak Ave', city: 'Springfield', state_or_region: 'IL', postal_code: '62702' }
		],
		turfs: [
			{
				id: 'turf-1',
				code: 'AB12CD',
				expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
				created_at: new Date().toISOString(),
				author: 'jdoe',
				survey_name: 'Door Knock Survey',
				location_count: '14'
			},
			{
				id: 'turf-2',
				code: 'XY34ZW',
				expires_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
				created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
				author: 'asmith',
				survey_name: null,
				location_count: '7'
			}
		]
	}}
/>

<Story
	name="Empty List"
	args={{
		orgSlug: 'test-org',
		bucketName: 'Registered Voters',
		bucketSlug: 'registered-voters',
		listHref: '/o/test-org/s/universe/buckets/registered-voters/lists/3',
		list: {
			id: '3',
			name: 'Empty Snapshot',
			entity_type: 'people',
			expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
			created_at: new Date().toISOString()
		},
		entries: [],
		turfs: []
	}}
/>

<Story
	name="Expired List"
	args={{
		orgSlug: 'test-org',
		bucketName: 'Registered Voters',
		bucketSlug: 'registered-voters',
		listHref: '/o/test-org/s/universe/buckets/registered-voters/lists/4',
		list: {
			id: '4',
			name: 'Old Campaign List',
			entity_type: 'people',
			expires_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
			created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
		},
		entries: [
			{ record_id: 'a', record_source: 'org_person', entity_id: 'ent-a', first_name: 'Alice', last_name: 'Nguyen', email: 'alice@example.com', phone: null }
		],
		turfs: []
	}}
/>
