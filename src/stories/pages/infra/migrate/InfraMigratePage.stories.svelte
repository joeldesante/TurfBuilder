<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraMigratePage from './InfraMigratePage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Infra/Migrate',
		component: InfraMigratePage,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen'
		}
	});
</script>

<Story name="Default" />
