<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BucketFiltersPage from '$pages/o/s/universe/buckets/filters/BucketFiltersPage.svelte';
	import type { BucketFilters } from '$lib/shared/types/filters';

	const { data } = $props();

	async function handleSave(filters: BucketFilters) {
		const res = await fetch(`/api/v1/buckets/${data.bucket.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ filters })
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new Error(body.message ?? 'The filters could not be saved.');
		}
		await invalidateAll();
	}
</script>

<BucketFiltersPage
	bucketName={data.bucket.name}
	filters={data.bucket.filters}
	problem={data.bucket.problem}
	orgId={data.organization.id}
	onSave={handleSave}
/>
