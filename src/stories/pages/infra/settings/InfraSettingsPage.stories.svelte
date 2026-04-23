<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraSettingsPage from './InfraSettingsPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Infra/Settings',
		component: InfraSettingsPage,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen'
		}
	});
</script>

<Story
	name="Default"
	args={{
		settings: [
			{
				key: 'organizations.allow_creation',
				value: 'true',
				description: 'Whether users can create new organizations.'
			}
		],
		onToggle: async () => {}
	}}
/>

<Story
	name="Creation Disabled"
	args={{
		settings: [
			{
				key: 'organizations.allow_creation',
				value: 'false',
				description: 'Whether users can create new organizations.'
			}
		],
		onToggle: async () => {}
	}}
/>

<Story
	name="Empty"
	args={{
		settings: [],
		onToggle: async () => {}
	}}
/>
