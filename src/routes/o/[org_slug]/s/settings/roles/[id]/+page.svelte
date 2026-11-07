<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import RoleDetailPage from '$pages/o/s/settings/roles/RoleDetailPage.svelte';
	import { api } from '$lib/client/api';

	const { data } = $props();
	const orgSlug = $derived($page.params.org_slug);

	async function handleSavePermissions(permissions: string[]) {
		await api(`/roles/${data.role.id}/permissions`, { method: 'PUT', body: { permissions } });
	}

	async function handleSaveName(name: string) {
		await api(`/roles/${data.role.id}`, { method: 'PATCH', body: { name } });
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>{data.role.name} | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<RoleDetailPage
	role={data.role}
	rolesHref="/o/{orgSlug}/s/settings/roles"
	onSavePermissions={handleSavePermissions}
	onSaveName={handleSaveName}
/>
