<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import UniverseDataManagerPage from './UniverseDataManagerPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/DataManager',
		component: UniverseDataManagerPage,
		tags: ['autodocs']
	});
</script>

<Story name="Default" />
