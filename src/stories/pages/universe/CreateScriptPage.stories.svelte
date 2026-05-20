<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CreateScriptPage from './CreateScriptPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/CreateScript',
		component: CreateScriptPage,
		tags: ['autodocs']
	});
</script>

<Story name="Default" args={{ onCreate: async () => {} }} />
