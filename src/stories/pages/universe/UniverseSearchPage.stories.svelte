<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import UniverseSearchPage from './UniverseSearchPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/Search',
		component: UniverseSearchPage,
		tags: ['autodocs']
	});
</script>

<Story name="Default" />
