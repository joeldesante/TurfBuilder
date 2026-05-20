<script lang="ts">
	import BucketListsPage from '$pages/universe/BucketListsPage.svelte';

	const { data } = $props();
</script>

<BucketListsPage bucketName={data.bucket.name} />
