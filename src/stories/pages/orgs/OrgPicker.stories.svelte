<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import OrgPicker from './OrgPicker.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Orgs/OrgPicker',
		component: OrgPicker,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle: 'Organization selection page shown to users who belong to multiple organizations.'
			}
		}
	});

	function noop() {}
</script>

<Story name="Default" args={{ onSelect: noop }} />

<Story name="With Create Link" args={{ allowCreation: true, onSelect: noop }} />
