<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import { onMount } from 'svelte';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';

	export interface MapLayer {
		id: string;
		label: string;
		data: GeoJSON.GeoJSON;
		visible?: boolean;
	}

	interface Props {
		layers?: MapLayer[];
		defaultCenter?: [number, number];
		defaultZoom?: number;
		class?: string;
		onSelectedGeometriesChange: (features: Array<GeoJSON.Geometry>) => void;
	}

	let {
		layers = [],
		defaultCenter = [-75.2238, 40.0259],
		defaultZoom = 12,
		onSelectedGeometriesChange
	}: Props = $props();

	let map: maplibregl.Map | undefined;
	let mapContainer: HTMLDivElement;
	let isMapReady: boolean = $state(false);
	let selectedFeatures: maplibregl.MapGeoJSONFeature[] = $state([]);

	onMount(() => {
		map = new maplibregl.Map({
			container: mapContainer,
			style: 'https://tiles.openfreemap.org/styles/positron',
			center: defaultCenter,
			zoom: defaultZoom
		});

		map.on('load', () => (isMapReady = true));

		return () => map?.remove();
	});

	$effect(() => {
		if (map == undefined || isMapReady == false) return;

		for (const layer of layers) {
			if (map.getSource(layer.id) == undefined) {
				map.addSource(layer.id, {
					type: 'geojson',
					data: layer.data,
					generateId: true
				});

				// Shapes & Lines
				const firstLabelId = map.getStyle().layers.find((l) => l.id.endsWith('-labels'))?.id;

				map.addLayer(
					{
						id: layer.id,
						type: 'line',
						source: layer.id,
						paint: {
							'line-color': '#666666',
							'line-width': 3
						}
					},
					firstLabelId
				);

				map.addLayer(
					{
						id: `${layer.id}-area`,
						type: 'fill',
						source: layer.id,
						paint: {
							'fill-color': '#000000',
							'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.15, 0]
						}
					},
					firstLabelId
				);

				// Text Labels
				map.addLayer({
					id: `${layer.id}-labels`,
					type: 'symbol',
					source: layer.id,
					layout: {
						'text-field': ['get', 'name'],
						'text-size': 12,
						'text-font': ['sans-serif']
					},
					paint: {
						'text-color': '#000000'
					}
				});

				// Interactivity
				map.on('click', `${layer.id}-area`, (event) => {
					console.log('Click', event);
				});

				let hoveredId: number | undefined;

				map.on('mousemove', `${layer.id}-area`, (event) => {
					map!.getCanvas().style.cursor = 'pointer';

					const id = event.features?.[0]?.id as number | undefined;
					if (id === hoveredId) return;
					if (hoveredId !== undefined) {
						map!.setFeatureState({ source: layer.id, id: hoveredId }, { hover: false });
					}
					hoveredId = id;
					if (id !== undefined) {
						map!.setFeatureState({ source: layer.id, id }, { hover: true });
					}
				});

				map.on('mouseleave', `${layer.id}-area`, () => {
					map!.getCanvas().style.cursor = '';

					if (hoveredId !== undefined) {
						map!.setFeatureState({ source: layer.id, id: hoveredId }, { hover: false });
					}
					hoveredId = undefined;
				});
			} else {
				let existingSource = map.getSource(layer.id) as maplibregl.GeoJSONSource;
				existingSource.setData(layer.data);
			}

			const visibility = layer.visible === true ? 'visible' : 'none';
			map.setLayoutProperty(layer.id, 'visibility', visibility);
			map.setLayoutProperty(`${layer.id}-area`, 'visibility', visibility);
			map.setLayoutProperty(`${layer.id}-labels`, 'visibility', visibility);
		}
	});

	$effect(() => {
		let geometries = selectedFeatures.map((feature) => {
			return feature.geometry;
		});
		onSelectedGeometriesChange(geometries);
	});
</script>

<div class="h-full w-full relative">
	<!-- Map -->
	<div bind:this={mapContainer} class="absolute inset-0"></div>
	{#if layers.length > 0}
		<div
			class="absolute right-3 top-3 z-10 min-w-40 rounded-lg border border-outline-subtle bg-surface-container-lowest p-3 shadow-md"
		>
			<p class="mb-2 text-xs font-semibold tracking-wide text-on-surface-subtle uppercase">
				Layers
			</p>
			<div class="flex flex-col gap-2">
				{#each layers as layer (layer.id)}
					<Checkbox bind:checked={layer.visible}>
						{layer.label}
					</Checkbox>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	* {
		user-select: none;
	}
</style>
