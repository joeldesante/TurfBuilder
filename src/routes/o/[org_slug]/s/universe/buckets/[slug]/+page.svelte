<script lang="ts">
	import BucketDetailPage from '$pages/universe/buckets/BucketDetailPage.svelte';

	const { data } = $props();
</script>

<BucketDetailPage name={data.bucket.name} />
