<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import RolesPage from '$pages/settings/roles/RolesPage.svelte';

	const { data } = $props();
	const orgSlug = $derived($page.params.org_slug);

	async function handleCreate(name: string) {
		const res = await fetch(`/o/${orgSlug}/s/api/roles`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name })
		});
		if (!res.ok) {
			const body = await res.json();
			throw new Error(body.error ?? 'Failed to create role.');
		}
		await invalidateAll();
	}

	async function handleDelete(id: string) {
		const res = await fetch(`/o/${orgSlug}/s/api/roles/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			const body = await res.json();
			throw new Error(body.error ?? 'Failed to delete role.');
		}
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Roles | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<RolesPage
	roles={data.roles}
	roleDetailHref={(id) => `/o/${orgSlug}/s/settings/roles/${id}`}
	onCreate={handleCreate}
	onDelete={handleDelete}
/>
