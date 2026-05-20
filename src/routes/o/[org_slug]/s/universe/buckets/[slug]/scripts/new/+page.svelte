<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import CreateScriptPage from '$pages/universe/CreateScriptPage.svelte';

	const { data } = $props();

	async function handleCreate(name: string) {
		const res = await fetch(`/o/${data.organization.slug}/s/api/scripts`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, bucketId: data.bucket.id })
		});
		if (!res.ok) {
			const { error } = await res.json().catch(() => ({ error: 'Failed to create script.' }));
			throw new Error(error);
		}
		const { id } = await res.json();
		await invalidateAll();
		goto(`/o/${data.organization.slug}/s/universe/buckets/${data.bucket.slug}/scripts/${id}`);
	}
</script>

<CreateScriptPage onCreate={handleCreate} />
