<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BrowsePublicLayersPage from './BrowsePublicLayersPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Map/Browse',
		component: BrowsePublicLayersPage,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle: 'Searchable list of public map layers that can be added to an organization.'
			}
		}
	});

	const sampleLayers = [
		{
			id: 'district-boundaries',
			label: 'District Boundaries',
			description: 'Electoral district outlines for the region.'
		},
		{
			id: 'polling-places',
			label: 'Polling Places',
			description: 'All active polling locations.'
		},
		{ id: 'transit-lines', label: 'Transit Lines' }
	];

	function noop() {
		return Promise.resolve();
	}

	async function simulateError() {
		await new Promise((_, reject) =>
			setTimeout(() => reject(new Error('Failed to add the layer.')), 600)
		);
	}
</script>

<Story name="Default" args={{ layers: sampleLayers, onAdd: noop }} />

<Story name="Empty" args={{ layers: [], onAdd: noop }} />

<Story name="Add Fails" args={{ layers: sampleLayers, onAdd: simulateError }} />
