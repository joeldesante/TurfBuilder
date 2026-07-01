<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import UniverseDataManagerPage from './UniverseDataManagerPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Manage',
		component: UniverseDataManagerPage,
		tags: ['autodocs']
	});
</script>

<Story name="Empty" args={{ peopleCount: 0, locationsCount: 0 }} />

<Story name="With Records" args={{ peopleCount: 1452, locationsCount: 834 }} />

<Story
	name="Read Only"
	args={{
		peopleCount: 200,
		locationsCount: 100
	}}
/>
