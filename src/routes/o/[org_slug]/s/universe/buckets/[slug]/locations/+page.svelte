<script lang="ts">
	import { page } from '$app/stores';
	import BucketLocationsPage from '$pages/o/s/universe/buckets/locations/BucketLocationsPage.svelte';

	const { data } = $props();

	const basePath = `/o/${$page.params.org_slug}/s/universe/buckets/${$page.params.slug}/locations`;
</script>

<BucketLocationsPage
	bucketName={data.bucket.name}
	locations={data.locations}
	enabled={data.enabled}
	{basePath}
/>
