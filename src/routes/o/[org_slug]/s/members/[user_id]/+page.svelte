<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import MemberDetailPage from '$pages/o/s/members/MemberDetailPage.svelte';
	import { api } from '$lib/client/api';

	const { data } = $props();
	const orgSlug = $derived($page.params.org_slug || '');

	async function handleSetPermission(permissionId: string, value: boolean | null) {
		const path = `/members/${data.member_id}/permissions/${permissionId}`;
		await (value === null
			? api(path, { method: 'DELETE' })
			: api(path, { method: 'PUT', body: { value } }));
		await invalidateAll();
	}
</script>

<MemberDetailPage
	userId={data.user.id}
	name={data.user.name}
	email={data.user.email}
	{orgSlug}
	permissions={data.permissions}
	onSetPermission={handleSetPermission}
/>
