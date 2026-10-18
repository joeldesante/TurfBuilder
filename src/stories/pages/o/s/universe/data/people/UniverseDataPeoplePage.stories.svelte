<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import UniverseDataPeoplePage from './UniverseDataPeoplePage.svelte';

	const people = [
		{ id: '1', first_name: 'Alice', last_name: 'Johnson', email: 'alice@example.com', phone: '555-0101', dob: '1985-04-12' },
		{ id: '2', first_name: 'Bob', last_name: 'Smith', email: null, phone: '555-0102', dob: null }
	];

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Data/People',
		component: UniverseDataPeoplePage,
		args: { orgSlug: 'acme', people, totalCount: 2 }
	});
</script>

<Story name="One Page" />
<Story name="Second Page Of Many" args={{ totalCount: 5400, page: 2, pageSize: 100 }} />
<Story name="Empty" args={{ people: [], totalCount: 0 }} />
