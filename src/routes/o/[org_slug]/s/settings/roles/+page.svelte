<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import RolesPage from '$pages/o/s/settings/roles/RolesPage.svelte';
	import { toast } from 'svelte-sonner';
	import { api, errorMessage } from '$lib/client/api';

	const { data } = $props();
	const orgSlug = $derived($page.params.org_slug);

	async function handleCreate(name: string) {
		await api(`/organizations/${data.organization.id}/roles`, { method: 'POST', body: { name } });
		await invalidateAll();
	}

	async function handleDelete(id: string) {
		try {
			await api(`/roles/${id}`, { method: 'DELETE' });
			toast.success('Role deleted.');
			await invalidateAll();
		} catch (e) {
			toast.error(errorMessage(e, 'The role could not be deleted.'));
		}
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
