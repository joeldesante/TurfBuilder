<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import LayeredMap, {
		type MapLayer
	} from '$components/data-display/layered-map/LayeredMap.svelte';
	import MapSidebarItem from '$components/data-display/layered-map/MapSidebarItem.svelte';
	import LoadingScreen from '$components/feedback/loading-screen/LoadingScreen.svelte';

	interface Props {
		orgSlug: string;
		layers: Promise<MapLayer[]> | MapLayer[];
		onImport: (features: GeoJSON.Feature[]) => void;
	}

	const { orgSlug, layers, onImport }: Props = $props();

	let selectedFeatures: Array<GeoJSON.Feature> = $state([]);
</script>

<div class="h-dvh w-screen relative">
	{#await layers}
		<LoadingScreen />
	{:then layers}
		<LayeredMap {layers} onSelectedFeaturesChange={(features) => (selectedFeatures = features)}>
			{#snippet sidebar()}
				<MapSidebarItem label="Overture Downloader">
					<div class="flex flex-col gap-4">
						<p class="text-sm text-pretty w-80">
							Make your selection on the map to include the regions for which you want to download
							location data.
						</p>
						<p class="text-sm text-nowrap">
							<span class="font-medium">{selectedFeatures.length} regions</span> included in your selection.
						</p>
						<Button
							disabled={selectedFeatures.length == 0}
							onclick={() => {
								onImport(selectedFeatures);
							}}>Import Locations</Button
						>
					</div>
				</MapSidebarItem>
			{/snippet}
		</LayeredMap>
	{/await}
</div>
