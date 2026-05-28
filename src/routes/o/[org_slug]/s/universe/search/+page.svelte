<script lang="ts">
	import UniverseSearchPage from '$pages/universe/universe-search-page/UniverseSearchPage.svelte';
	const { data } = $props();
</script>

<UniverseSearchPage orgSlug={data.orgSlug} tableSchemas={data.tableSchemas} />
