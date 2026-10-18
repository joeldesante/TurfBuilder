<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import CreateBucketPage from '$pages/o/s/universe/buckets/new/CreateBucketPage.svelte';
	import type { BucketFilters } from '$lib/shared/types/filters';

	const { data } = $props();

	async function handleCreate(name: string, slug: string, filters: BucketFilters) {
		const res = await fetch(`/api/v1/organizations/${data.organization.id}/buckets`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, slug, filters })
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new Error(body.message ?? 'Failed to create bucket.');
		}
		const bucket = await res.json();
		await invalidateAll();
		goto(`/o/${data.organization.slug}/s/universe/buckets/${bucket.slug}`);
	}
</script>

<CreateBucketPage orgId={data.organization.id} onCreate={handleCreate} />
