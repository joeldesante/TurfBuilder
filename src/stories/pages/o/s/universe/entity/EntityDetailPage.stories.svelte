<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import EntityDetailPage from './EntityDetailPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Entity/Detail',
		component: EntityDetailPage,
		tags: ['autodocs']
	});
</script>

<Story
	name="Person - Current"
	args={{
		orgSlug: 'test-org',
		entityType: 'person',
		entityId: 'ent-abc-123',
		record: {
			id: 'rec-001',
			entity_id: 'ent-abc-123',
			first_name: 'Alice',
			middle_name: null,
			last_name: 'Nguyen',
			suffix: null,
			preferred_name: 'Ali',
			dob: '1990-03-15',
			phone: '555-1234',
			email: 'alice@example.com',
			gender: 'Female',
			valid_to: null,
			source: 'org'
		},
		isOutdated: false
	}}
/>

<Story
	name="Person - Outdated Version"
	args={{
		orgSlug: 'test-org',
		entityType: 'person',
		entityId: 'ent-abc-123',
		record: {
			id: 'rec-000',
			entity_id: 'ent-abc-123',
			first_name: 'Alice',
			middle_name: null,
			last_name: 'Smith',
			suffix: null,
			preferred_name: null,
			dob: '1990-03-15',
			phone: '555-9999',
			email: 'alice.smith@oldmail.com',
			gender: null,
			valid_to: new Date().toISOString(),
			source: 'org'
		},
		isOutdated: true
	}}
/>

<Story
	name="Location - Current"
	args={{
		orgSlug: 'test-org',
		entityType: 'location',
		entityId: 'ent-loc-456',
		record: {
			id: 'rec-loc-001',
			entity_id: 'ent-loc-456',
			name: 'City Hall',
			address_line_1: '100 Main St',
			address_line_2: null,
			address_line_3: null,
			city: 'Springfield',
			state_or_region: 'IL',
			postal_code: '62701',
			country_code: 'US',
			valid_to: null,
			source: 'org'
		},
		isOutdated: false
	}}
/>

<Story
	name="Location - Outdated Version"
	args={{
		orgSlug: 'test-org',
		entityType: 'location',
		entityId: 'ent-loc-456',
		record: {
			id: 'rec-loc-000',
			entity_id: 'ent-loc-456',
			name: 'Old Office',
			address_line_1: '50 Oak Ave',
			address_line_2: null,
			address_line_3: null,
			city: 'Springfield',
			state_or_region: 'IL',
			postal_code: '62700',
			country_code: 'US',
			valid_to: new Date().toISOString(),
			source: 'org'
		},
		isOutdated: true
	}}
/>
