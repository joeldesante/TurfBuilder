<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import RoleDetailPage from '$pages/settings/roles/RoleDetailPage.svelte';

	const { data } = $props();
	const orgSlug = $derived($page.params.org_slug);
	const roleId = $derived($page.params.id);

	async function handleSavePermissions(permissions: string[]) {
		const res = await fetch(`/o/${orgSlug}/s/api/roles/${roleId}/permissions`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ permissions })
		});
		if (!res.ok) {
			const body = await res.json();
			throw new Error(body.error ?? 'Failed to save permissions.');
		}
	}

	async function handleSaveName(name: string) {
		const res = await fetch(`/o/${orgSlug}/s/api/roles/${roleId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name })
		});
		if (!res.ok) {
			const body = await res.json();
			throw new Error(body.error ?? 'Failed to save role.');
		}
		await invalidateAll();
	}

	async function handleAssignRole(userId: string, assignedRoleId: string | null) {
		const res = await fetch(`/o/${orgSlug}/s/api/members/${userId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ role_id: assignedRoleId })
		});
		if (!res.ok) {
			const body = await res.json();
			throw new Error(body.error ?? 'Failed to assign role.');
		}
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>{data.role.name} | {data.config.application_name}</title>
</svelte:head>

<RoleDetailPage
	role={data.role}
	members={data.members}
	rolesHref="/o/{orgSlug}/s/settings/roles"
	onSavePermissions={handleSavePermissions}
	onSaveName={handleSaveName}
	onAssignRole={handleAssignRole}
/>
