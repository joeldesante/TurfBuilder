<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SetupPage from './SetupPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Setup/SetupPage',
		component: SetupPage,
		parameters: {
			layout: 'fullscreen'
		}
	});
</script>

<Story name="Default" />
