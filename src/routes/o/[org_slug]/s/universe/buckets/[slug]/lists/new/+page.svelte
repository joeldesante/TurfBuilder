<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import CreateListPage from '$pages/universe/buckets/lists/new/CreateListPage.svelte';

	const { data } = $props();

	// Captured once — org/bucket slugs come from server load data and don't change.
	const orgSlug = untrack(() => data.organization.slug);
	const bucketSlug = untrack(() => data.bucket.slug);

	async function handleCreate(payload: {
		name: string;
		entity_type: 'people' | 'locations';
		expires_at: string;
		filter: {
			matchType: 'ONE_OR_MORE' | 'ALL' | 'NONE';
			conditions: { filterId: string; qualifierId: string; value: string }[];
		};
	}) {
		const response = await fetch(
			`/o/${orgSlug}/s/api/buckets/${bucketSlug}/lists`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			}
		);

		if (!response.ok) {
			const body = await response.json().catch(() => ({}));
			throw new Error(body.message ?? 'Failed to create list');
		}

		await invalidateAll();
		await goto(`/o/${orgSlug}/s/universe/buckets/${bucketSlug}/lists`);
	}
</script>

<CreateListPage
	bucketName={data.bucket.name}
	bucketFilter={data.bucket.filter}
	onCreate={handleCreate}
/>
