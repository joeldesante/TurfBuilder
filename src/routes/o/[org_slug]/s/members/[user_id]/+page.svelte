<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import MemberDetailPage from '$pages/orgs/members/MemberDetailPage.svelte';

	const { data } = $props();
	const orgSlug = $derived($page.params.org_slug);
	const userId = $derived($page.params.user_id);

	async function handleSetPermission(permissionId: string, value: boolean | null) {
		const res = await fetch(`/o/${orgSlug}/s/api/members/${userId}/permissions`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ permission_id: permissionId, value })
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new Error(body.error ?? 'Failed to save permission.');
		}
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
