<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PersonProfilePage from './PersonProfilePage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/People/Profile',
		component: PersonProfilePage,
		tags: ['autodocs']
	});
</script>

<Story
	name="Full Record"
	args={{
		backHref: '/buckets/registered-voters/people',
		person: {
			id: '1',
			first_name: 'Alice',
			middle_name: 'Marie',
			last_name: 'Johnson',
			suffix: null,
			preferred_name: 'Ali',
			dob: new Date('1985-04-12'),
			phone: '555-0101',
			email: 'alice@example.com',
			gender: 'Female',
			source: 'public'
		}
	}}
/>

<Story
	name="Minimal Record"
	args={{
		backHref: '/buckets/registered-voters/people',
		person: {
			id: '2',
			first_name: 'Bob',
			middle_name: null,
			last_name: 'Smith',
			suffix: null,
			preferred_name: null,
			dob: null,
			phone: null,
			email: null,
			gender: null,
			source: 'org'
		}
	}}
/>
