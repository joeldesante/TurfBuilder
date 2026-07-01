<script lang="ts">
	import { page } from '$app/stores';
	import LocationDetailPage from '$pages/o/s/universe/buckets/locations/LocationDetailPage.svelte';

	const { data } = $props();

	const backHref = `/o/${$page.params.org_slug}/s/universe/buckets/${$page.params.slug}/locations`;
</script>

<LocationDetailPage location={data.location} {backHref} />
