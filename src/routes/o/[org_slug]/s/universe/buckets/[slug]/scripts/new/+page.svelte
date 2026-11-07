<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import CreateScriptPage from '$pages/o/s/universe/buckets/scripts/new/CreateScriptPage.svelte';
	import { api } from '$lib/client/api';

	const { data } = $props();

	async function handleCreate(name: string) {
		const { id } = await api<{ id: string }>(`/buckets/${data.bucket.id}/scripts`, {
			method: 'POST',
			body: { name }
		});
		await invalidateAll();
		goto(`/o/${data.organization.slug}/s/universe/buckets/${data.bucket.slug}/scripts/${id}`);
	}
</script>

<CreateScriptPage onCreate={handleCreate} />
