<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import UniverseReportsPage from './UniverseReportsPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/Reports',
		component: UniverseReportsPage,
		tags: ['autodocs']
	});
</script>

<Story name="Default" />
