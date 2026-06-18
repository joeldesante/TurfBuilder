<script lang="ts">
	import UniverseDataPeoplePage from '$pages/universe/data/people/UniverseDataPeoplePage.svelte';
	const { data } = $props();
</script>

<UniverseDataPeoplePage orgSlug={data.organization.slug} totalCount={data.totalCount} people={data.people} />
