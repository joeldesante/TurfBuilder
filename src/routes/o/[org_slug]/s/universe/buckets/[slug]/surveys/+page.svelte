<script lang="ts">
	import BucketSurveysPage from '$pages/universe/BucketSurveysPage.svelte';

	const { data } = $props();
</script>

<BucketSurveysPage
	bucketName={data.bucket.name}
	orgSlug={data.organization.slug}
	surveys={data.surveys}
/>
