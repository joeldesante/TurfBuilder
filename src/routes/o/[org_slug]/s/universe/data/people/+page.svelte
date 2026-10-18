<script lang="ts">
	import UniverseDataPeoplePage from '$pages/o/s/universe/data/people/UniverseDataPeoplePage.svelte';
	const { data } = $props();
</script>

<UniverseDataPeoplePage
	orgSlug={data.organization.slug}
	totalCount={data.totalCount}
	page={data.page}
	pageSize={data.pageSize}
	people={data.people}
/>
