<script lang="ts">
	import CreateMapLayerPage from '$pages/o/s/map/create/CreateMapLayerPage.svelte';

	async function onCreate(data: { layerName: string; geojson: File }) {
		// TODO: submit to the layer creation API endpoint once it exists
		console.log('create layer', data.layerName, data.geojson);
	}
</script>

<CreateMapLayerPage {onCreate} />
