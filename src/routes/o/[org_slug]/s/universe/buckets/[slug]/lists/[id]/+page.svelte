<script lang="ts">
	import ListDetailPage from '$pages/o/s/universe/buckets/lists/ListDetailPage.svelte';
	import { page } from '$app/state';
	import type {
		PersonEntry,
		LocationEntry,
		TurfEntry
	} from '$pages/o/s/universe/buckets/lists/ListDetailPage.svelte';

	const { data } = $props();

	// Access a specific query param, e.g., ?id=123
	let selectedTab = page.url.searchParams.get('tab');

	const listHref = `/o/${data.organization.slug}/s/universe/buckets/${data.bucket.slug}/lists/${data.list.id}`;
</script>

<ListDetailPage
	orgSlug={data.organization.slug}
	bucketName={data.bucket.name}
	bucketSlug={data.bucket.slug}
	{listHref}
	list={data.list}
	entries={data.entries as unknown as PersonEntry[] | LocationEntry[]}
	turfs={data.turfs as TurfEntry[]}
	{selectedTab}
/>
