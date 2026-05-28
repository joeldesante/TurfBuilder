<script lang="ts">
	import BucketSurveysPage from '$pages/universe/bucket/bucket-surveys-page/BucketSurveysPage.svelte';

	const { data } = $props();
</script>

<BucketSurveysPage
	bucketName={data.bucket.name}
	bucketSlug={data.bucket.slug}
	orgSlug={data.organization.slug}
	surveys={data.surveys}
/>
