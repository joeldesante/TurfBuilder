<script lang="ts">
	import BucketDetailPage from '$pages/o/s/universe/buckets/BucketDetailPage.svelte';

	const { data } = $props();
</script>

<BucketDetailPage name={data.bucket.name} />
