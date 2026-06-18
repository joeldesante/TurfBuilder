<script lang="ts">
	import BucketScriptsPage from '$pages/universe/buckets/scripts/BucketScriptsPage.svelte';

	const { data } = $props();
</script>

<BucketScriptsPage
	bucketName={data.bucket.name}
	bucketSlug={data.bucket.slug}
	orgSlug={data.organization.slug}
	scripts={data.scripts}
	createHref={`/o/${data.organization.slug}/s/universe/buckets/${data.bucket.slug}/scripts/new`}
/>
