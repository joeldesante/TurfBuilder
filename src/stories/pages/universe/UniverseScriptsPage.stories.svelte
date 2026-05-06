<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import UniverseScriptsPage from './UniverseScriptsPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/Scripts',
		component: UniverseScriptsPage,
		tags: ['autodocs']
	});
</script>

<Story name="Default" />
