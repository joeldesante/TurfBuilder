<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LayeredMap from './LayeredMap.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Display/Layered Map',
		component: LayeredMap,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen'
		}
	});

	// Real neighborhood boundaries from OpenDataPhilly, simplified for the story
	const sampleLayers = [
		{
			id: 'turfs',
			label: 'Turfs',
			visible: true,
			data: {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						properties: { name: 'Manayunk' },
						geometry: {
							type: 'Polygon',
							coordinates: [
								[
									[-75.2234, 40.0337],
									[-75.2144, 40.0247],
									[-75.2193, 40.0216],
									[-75.2353, 40.0304],
									[-75.226, 40.0365],
									[-75.2234, 40.0337]
								]
							]
						}
					},
					{
						type: 'Feature',
						properties: { name: 'Wissahickon' },
						geometry: {
							type: 'Polygon',
							coordinates: [
								[
									[-75.2036, 40.0185],
									[-75.2072, 40.0166],
									[-75.2082, 40.0132],
									[-75.2193, 40.0216],
									[-75.2154, 40.0239],
									[-75.2113, 40.0186],
									[-75.2077, 40.0238],
									[-75.2032, 40.0259],
									[-75.2045, 40.0209],
									[-75.2036, 40.0185]
								]
							]
						}
					}
				]
			}
		},
		{
			id: 'locations',
			label: 'Locations',
			visible: true,
			data: {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						properties: { name: 'East Falls' },
						geometry: {
							type: 'Polygon',
							coordinates: [
								[
									[-75.1848, 40.0283],
									[-75.1726, 40.0178],
									[-75.1898, 40.0089],
									[-75.1919, 40.0066],
									[-75.2034, 40.0101],
									[-75.2077, 40.0128],
									[-75.2059, 40.0153],
									[-75.2051, 40.0151],
									[-75.2023, 40.0158],
									[-75.1988, 40.0202],
									[-75.1932, 40.0241],
									[-75.1926, 40.0273],
									[-75.1878, 40.0308],
									[-75.1848, 40.0283]
								]
							]
						}
					}
				]
			}
		},
		{
			id: 'responses',
			label: 'Responses',
			visible: true,
			data: {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						properties: { name: 'Roxborough' },
						geometry: {
							type: 'Polygon',
							coordinates: [
								[
									[-75.2032, 40.0259],
									[-75.2077, 40.0238],
									[-75.2113, 40.0186],
									[-75.2154, 40.0239],
									[-75.2144, 40.0247],
									[-75.2166, 40.0276],
									[-75.226, 40.0365],
									[-75.2141, 40.0401],
									[-75.2096, 40.0366],
									[-75.2076, 40.0316],
									[-75.2056, 40.0325],
									[-75.2034, 40.0296],
									[-75.2056, 40.0287],
									[-75.2032, 40.0259]
								]
							]
						}
					}
				]
			}
		}
	];
</script>

{#snippet template(args)}
	<div class="h-screen w-screen">
		<LayeredMap {...args} />
	</div>
{/snippet}

<Story name="Default" args={{ layers: sampleLayers }} {template} />

<Story name="Empty" args={{ layers: [] }} {template} />
