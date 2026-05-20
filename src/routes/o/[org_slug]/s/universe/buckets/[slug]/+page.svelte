<script lang="ts">
	import BucketDetailPage from '$pages/universe/BucketDetailPage.svelte';

	const { data } = $props();
</script>

<BucketDetailPage name={data.bucket.name} />
