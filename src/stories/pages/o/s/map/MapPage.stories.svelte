<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import MapPage from './MapPage.svelte';
	import type { MapLayer } from '$components/data-display/layered-map/LayeredMap.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Map',
		component: MapPage,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle: "Staff map view showing the organization's layers with library and create actions."
			}
		}
	});

	const sampleLayers: MapLayer[] = [
		{
			id: 'sample-turf',
			label: 'Sample Turf',
			visible: true,
			data: {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						properties: { name: 'Sample Turf' },
						geometry: {
							type: 'Polygon',
							coordinates: [
								[
									[-75.235, 40.02],
									[-75.21, 40.02],
									[-75.21, 40.032],
									[-75.235, 40.032],
									[-75.235, 40.02]
								]
							]
						}
					}
				]
			}
		}
	];

	const pendingLayers = new Promise<MapLayer[]>(() => {});
	const failedLayers = Promise.reject(new Error('Failed to load map layers.'));
	failedLayers.catch(() => {});
</script>

<Story name="Default" args={{ layers: sampleLayers }} />

<Story name="Empty" args={{ layers: [] }} />

<Story name="Loading" args={{ layers: pendingLayers }} />

<Story name="Load Failed" args={{ layers: failedLayers }} />
