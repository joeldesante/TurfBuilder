<script lang="ts">
	import BucketDetailPage from '$pages/universe/bucket/bucket-detail-page/BucketDetailPage.svelte';

	const { data } = $props();
</script>

<BucketDetailPage name={data.bucket.name} />
