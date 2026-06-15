<script lang="ts">
	import UniverseDataPeoplePage from '$pages/universe/universe-data-people-page/UniverseDataPeoplePage.svelte';
	const { data } = $props();
</script>

<UniverseDataPeoplePage orgSlug={data.organization.slug} totalCount={data.totalCount} people={data.people} />
