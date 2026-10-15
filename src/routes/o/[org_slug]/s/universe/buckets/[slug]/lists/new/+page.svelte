<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import CreateListPage from '$pages/o/s/universe/buckets/lists/new/CreateListPage.svelte';
	import type { CreateListPayload } from '$pages/o/s/universe/buckets/lists/new/CreateListPage.svelte';

	const { data } = $props();

	// Captured once — the org and bucket come from server load data and don't change.
	const orgSlug = untrack(() => data.organization.slug);
	const bucket = untrack(() => data.bucket);

	async function handleCreate(payload: CreateListPayload) {
		const response = await fetch(`/api/v1/buckets/${bucket.id}/lists`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			const body = await response.json().catch(() => ({}));
			throw new Error(body.message ?? 'Failed to create list');
		}

		await invalidateAll();
		await goto(`/o/${orgSlug}/s/universe/buckets/${bucket.slug}/lists`);
	}
</script>

<CreateListPage
	bucketName={data.bucket.name}
	bucketFilter={{
		people: { enabled: data.bucket.filters.people !== null },
		locations: { enabled: data.bucket.filters.locations !== null }
	}}
	orgId={data.organization.id}
	onCreate={handleCreate}
/>
