<script lang="ts">
	import MapPage from '$pages/o/s/map/MapPage.svelte';

	const { data } = $props();
</script>

<MapPage layers={data.layers} />
