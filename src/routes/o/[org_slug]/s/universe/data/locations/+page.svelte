<script lang="ts">
	import UniverseDataLocationsPage from '$pages/universe/data/locations/UniverseDataLocationsPage.svelte';
	const { data } = $props();
</script>

<UniverseDataLocationsPage orgSlug={data.organization.slug} totalCount={data.totalCount} locations={data.locations} />
