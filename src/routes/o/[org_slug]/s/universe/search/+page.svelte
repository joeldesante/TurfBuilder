<script lang="ts">
	import UniverseSearchPage from '$pages/o/s/universe/search/UniverseSearchPage.svelte';
	const { data } = $props();
</script>

<UniverseSearchPage orgSlug={data.orgSlug} tableSchemas={data.tableSchemas} />
