<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CreateMapLayerPage from './CreateMapLayerPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Map/Create',
		component: CreateMapLayerPage,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle: 'Form for creating a custom map layer from an uploaded GeoJSON file.'
			}
		}
	});

	function noop() {
		return Promise.resolve();
	}

	async function simulateError() {
		await new Promise((_, reject) =>
			setTimeout(() => reject(new Error('Failed to upload the layer.')), 600)
		);
	}
</script>

<Story name="Default" args={{ onCreate: noop }} />

<Story name="Upload Fails" args={{ onCreate: simulateError }} />
