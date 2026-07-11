<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import { onMount, type Snippet } from 'svelte';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';
	import MapSidebarItem from './MapSidebarItem.svelte';

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
		sidebar?: Snippet;
		onSelectedFeaturesChange?: (features: Array<GeoJSON.Feature>) => void;
	}

	let {
		layers = [],
		defaultCenter = [-75.2238, 40.0259],
		defaultZoom = 12,
		sidebar,
		onSelectedFeaturesChange = (_: Array<GeoJSON.Feature>) => {}
	}: Props = $props();

	let map: maplibregl.Map | undefined;
	let mapContainer: HTMLDivElement;
	let isMapReady: boolean = $state(false);
	let selectedFeatures: maplibregl.MapGeoJSONFeature[] = $state([]);
	let layerVisibility = $state<Record<string, boolean>>({});

	function isLayerVisible(layer: MapLayer): boolean {
		return layerVisibility[layer.id] ?? layer.visible ?? false;
	}

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
							'fill-opacity': [
								'case',
								['boolean', ['feature-state', 'selected'], false],
								0.4,
								['boolean', ['feature-state', 'hover'], false],
								0.15,
								0
							]
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
					let clickedFeature = event.features?.[0] || null;
					if (clickedFeature === null) {
						return;
					}

					const isSame = (f: maplibregl.MapGeoJSONFeature) =>
						f.id === clickedFeature.id && f.source === clickedFeature.source;
					if (selectedFeatures.some(isSame)) {
						selectedFeatures = selectedFeatures.filter((f) => !isSame(f));
						map!.setFeatureState(
							{ source: clickedFeature.source, id: clickedFeature.id },
							{ selected: false }
						);
					} else {
						selectedFeatures.push(clickedFeature);
						map!.setFeatureState(
							{ source: clickedFeature.source, id: clickedFeature.id },
							{ selected: true }
						);
					}
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

			const visibility = isLayerVisible(layer) ? 'visible' : 'none';
			map.setLayoutProperty(layer.id, 'visibility', visibility);
			map.setLayoutProperty(`${layer.id}-area`, 'visibility', visibility);
			map.setLayoutProperty(`${layer.id}-labels`, 'visibility', visibility);
		}
	});

	$effect(() => {
		let features = selectedFeatures
			.filter((feature) => {
				const layer = layers.find((l) => `${l.id}-area` === feature.layer.id);
				if (layer?.id === undefined) return;
				const layerId = `${layer?.id}-area`;
				if (feature.layer.id === layerId && isLayerVisible(layer)) {
					return feature;
				}
			})
			.map((feature) => {
				return feature;
			});

		onSelectedFeaturesChange(features);
	});
</script>

<div class="h-full w-full relative">
	<!-- Map -->
	<div bind:this={mapContainer} class="absolute inset-0"></div>

	<aside class="absolute right-3 top-3 max-w-120 flex flex-col gap-2 items-end overflow-y-auto">
		<!-- Layers panel will always be visible -->
		{#if layers.length > 0}
			<MapSidebarItem label="Layers">
				<div class="flex flex-col gap-2 text-nowrap">
					{#each layers as layer (layer.id)}
						<Checkbox
							checked={isLayerVisible(layer)}
							onCheckedChange={(checked) => (layerVisibility[layer.id] = checked)}
						>
							<span>{layer.label}</span>
						</Checkbox>
					{/each}
				</div>
			</MapSidebarItem>
		{/if}

		{@render sidebar?.()}
	</aside>
</div>

<style>
	* {
		user-select: none;
	}
</style>
