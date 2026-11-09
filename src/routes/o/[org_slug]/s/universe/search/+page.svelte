<script lang="ts">
	import UniverseSearchPage from '$pages/o/s/universe/search/UniverseSearchPage.svelte';
	const { data } = $props();
</script>

<UniverseSearchPage tableSchemas={data.tableSchemas} />
