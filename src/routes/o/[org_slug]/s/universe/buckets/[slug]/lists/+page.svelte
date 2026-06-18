<script lang="ts">
	import BucketListsPage from '$pages/universe/buckets/lists/BucketListsPage.svelte';

	const { data } = $props();
</script>

<BucketListsPage
	bucketName={data.bucket.name}
	bucketSlug={data.bucket.slug}
	orgSlug={data.organization.slug}
	lists={data.lists}
	createHref={`/o/${data.organization.slug}/s/universe/buckets/${data.bucket.slug}/lists/new`}
/>
