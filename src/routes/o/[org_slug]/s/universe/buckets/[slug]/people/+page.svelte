<script lang="ts">
	import { page } from '$app/stores';
	import BucketPeoplePage from '$pages/o/s/universe/buckets/people/BucketPeoplePage.svelte';

	const { data } = $props();

	const basePath = `/o/${$page.params.org_slug}/s/universe/buckets/${$page.params.slug}/people`;
</script>

<BucketPeoplePage
	bucketName={data.bucket.name}
	people={data.people}
	enabled={data.enabled}
	{basePath}
/>
