<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PluginsPage from './PluginsPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Orgs/PluginsPage',
		component: PluginsPage,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle: 'Plugin management page for enabling and disabling org-level features.'
			}
		}
	});

	const samplePlugins = [
		{
			slug: 'voter-file',
			name: 'Voter File',
			description: 'Import and match voter file data against canvassing results.',
			version: '1.0.0',
			installed: true,
			enabled: true
		},
		{
			slug: 'phone-bank',
			name: 'Phone Bank',
			description: 'Manage phone banking campaigns alongside field canvassing.',
			version: '0.9.0',
			installed: false,
			enabled: false
		},
		{
			slug: 'data-export',
			name: 'Data Export',
			description: 'Export canvassing data to CSV, Excel, or third-party CRMs.',
			version: '1.2.0',
			installed: true,
			enabled: false
		}
	];

	function noop() {
		return Promise.resolve();
	}
</script>

<Story name="With Plugins" args={{ plugins: samplePlugins, onToggle: noop }} />

<Story name="No Plugins" args={{ plugins: [], onToggle: noop }} />

<Story
	name="Single Active Plugin"
	args={{ plugins: [samplePlugins[0]], onToggle: noop }}
/>
