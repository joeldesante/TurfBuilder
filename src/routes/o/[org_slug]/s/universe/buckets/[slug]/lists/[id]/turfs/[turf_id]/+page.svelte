<script lang="ts">
	import TurfDetailPage from '$pages/universe/bucket/list-detail-page/TurfDetailPage.svelte';
	import { page } from '$app/state';

	const { data } = $props();

	const listHref = `/o/${page.params.org_slug}/s/universe/buckets/${data.bucketSlug}/lists/${data.listId}?tab=turfs`;
</script>

<TurfDetailPage
	turf={data.turf}
	{listHref}
	locations={data.locations}
	responses={data.responses}
/>
