<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraEmailTemplatesPage from './InfraEmailTemplatesPage.svelte';
	import { templates } from './fixtures';

	const { Story } = defineMeta({
		title: 'Pages/Infra/Email templates',
		component: InfraEmailTemplatesPage,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen', docs: { subtitle: 'The emails the app sends, with a mark on the ones an admin has edited.' } }
	});
</script>

<Story name="Templates" args={{ templates }} />

<Story name="None yet" args={{ templates: [] }} />
