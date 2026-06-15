<script lang="ts">
	import UniverseDataLocationsPage from '$pages/universe/universe-data-locations-page/UniverseDataLocationsPage.svelte';
	const { data } = $props();
</script>

<UniverseDataLocationsPage orgSlug={data.organization.slug} totalCount={data.totalCount} locations={data.locations} />
