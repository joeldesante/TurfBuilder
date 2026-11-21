<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import UniverseDataContactsPage from './UniverseDataContactsPage.svelte';
	import type { ContactSchema } from '$lib/shared/types/contact-schemas';

	const NAME = '11111111-1111-4111-8111-111111111111';
	const OPEN = '22222222-2222-4222-8222-222222222222';
	const STAFF = '33333333-3333-4333-8333-333333333333';
	const CAPACITY = '44444444-4444-4444-8444-444444444444';

	const business: ContactSchema = {
		id: 's1',
		org_id: 'o1',
		schema_name: 'Business',
		fields: [
			{ id: NAME, name: 'name', type: 'text', required: true },
			{ id: OPEN, name: 'open', type: 'boolean', required: false },
			{ id: STAFF, name: 'staff', type: 'number', required: false }
		],
		identifier_field_id: NAME,
		contact_count: 2,
		created_at: '',
		updated_at: ''
	};
	const venue: ContactSchema = {
		...business,
		id: 's2',
		schema_name: 'Venue',
		fields: [{ id: CAPACITY, name: 'capacity', type: 'number', required: false }],
		identifier_field_id: null
	};

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Data/Contacts',
		component: UniverseDataContactsPage,
		args: {
			orgSlug: 'acme',
			schemas: [business, venue],
			selected: business,
			contacts: [
				{
					id: 'c1',
					identifier: 'Corner Deli',
					metadata: { [NAME]: 'Corner Deli', [OPEN]: true, [STAFF]: 4 }
				},
				{ id: 'c2', identifier: '2 Elm St', metadata: { [NAME]: 'Night Owl', [OPEN]: false } }
			],
			totalCount: 2
		}
	});
</script>

<Story name="Business Tab" />
<Story name="No Contacts Yet" args={{ contacts: [], totalCount: 0 }} />
<Story
	name="All Tab"
	args={{
		selected: null,
		contacts: [
			{
				id: 'c1',
				identifier: 'Corner Deli',
				metadata: { [NAME]: 'Corner Deli', [OPEN]: true },
				schema_id: 's1',
				schema_name: 'Business'
			}
		],
		totalCount: 1
	}}
/>
<Story
	name="Map View"
	args={{
		view: 'map',
		markers: [
			{
				id: 'c1',
				name: 'Corner Deli',
				address_line_1: '1 Main St',
				city: 'Philadelphia',
				latitude: 40.0,
				longitude: -75.2
			}
		]
	}}
/>
<Story name="No Schemas" args={{ schemas: [], selected: null, contacts: [], totalCount: 0 }} />
