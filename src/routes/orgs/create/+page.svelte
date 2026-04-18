<script lang="ts">
	import { goto } from '$app/navigation';
	import CreateOrg from '$pages/orgs/create/CreateOrg.svelte';

	async function handleCreate(name: string, slug: string) {
		const res = await fetch('/orgs/create', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, slug })
		});
		if (!res.ok) {
			const { message } = await res.json().catch(() => ({ message: 'Failed to create organization.' }));
			throw new Error(message);
		}
		const { slug: newSlug } = await res.json();
		goto(`/o/${newSlug}/s/`);
	}
</script>

<svelte:head>
	<title>Create Organization</title>
</svelte:head>

<CreateOrg onCreate={handleCreate} />
