<script lang="ts">
	import UniverseSearchPage from '$pages/universe/UniverseSearchPage.svelte';
	const { data } = $props();
</script>

<UniverseSearchPage orgSlug={data.orgSlug} tableSchemas={data.tableSchemas} />
