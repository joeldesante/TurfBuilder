<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import CreateBucketPage from '$pages/universe/bucket/create-bucket-page/CreateBucketPage.svelte';
	import type { BucketFilterInput } from '$lib/server/filter-converter';

	const { data } = $props();

	async function handleCreate(name: string, slug: string, filter: BucketFilterInput) {
		const res = await fetch(`/o/${data.organization.slug}/s/api/buckets`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, slug, filter })
		});
		if (!res.ok) {
			const { error } = await res.json().catch(() => ({ error: 'Failed to create bucket.' }));
			throw new Error(error);
		}
		const { slug: newSlug } = await res.json();
		await invalidateAll();
		goto(`/o/${data.organization.slug}/s/universe/buckets/${newSlug}`);
	}
</script>

<CreateBucketPage onCreate={handleCreate} />
