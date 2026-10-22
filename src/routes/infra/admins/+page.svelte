<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { api } from '$lib/client/api';
	import InfraAdminsPage from '$pages/infra/admins/InfraAdminsPage.svelte';
	import type { Page } from '$lib/shared/utils/pagination';
	import type { PlatformUserRow } from '$lib/shared/types/platform-users';

	const { data } = $props();

	async function onsearch(query: string) {
		const page = await api<Page<PlatformUserRow>>(`/users?q=${encodeURIComponent(query)}`);
		return page.items.slice(0, 10).map(({ id, name, email }) => ({ id, name, email }));
	}

	async function ongrant(userId: string, roleId: string) {
		await api(`/users/${userId}/infra-roles`, { method: 'POST', body: { roleId } });
		await invalidateAll();
		toast.success('Role given.');
	}

	async function onrevoke(userId: string, roleId: string) {
		await api(`/users/${userId}/infra-roles/${roleId}`, { method: 'DELETE' });
		await invalidateAll();
		toast.success('Role removed.');
	}
</script>

<svelte:head><title>Admins | Infrastructure</title></svelte:head>

<InfraAdminsPage admins={data.admins} roles={data.roles} currentUserId={data.user.id} {onsearch} {ongrant} {onrevoke} />
