<script lang="ts">
	import { page } from '$app/stores';
	import LocationDetailPage from '$pages/universe/bucket/location-detail-page/LocationDetailPage.svelte';

	const { data } = $props();

	const backHref = `/o/${$page.params.org_slug}/s/universe/buckets/${$page.params.slug}/locations`;
</script>

<LocationDetailPage location={data.location} {backHref} />
