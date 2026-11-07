<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import MembersPage from '$pages/o/s/members/MembersPage.svelte';
	import { api } from '$lib/client/api';

	const { data } = $props();
	const orgSlug = $derived($page.params.org_slug!);
	const orgId = $derived(data.organization.id);

	/** The page names members by user id; the API addresses the membership. */
	function memberId(userId: string): string {
		const member = data.members.find((m) => m.id === userId);
		if (!member) throw new Error('That member is no longer on this page.');
		return member.member_id;
	}

	async function handleAssignRole(userId: string, roleId: string | null) {
		await api(`/members/${memberId(userId)}`, { method: 'PATCH', body: { role_id: roleId } });
		await invalidateAll();
	}

	async function handleRemove(userId: string) {
		await api(`/members/${memberId(userId)}`, { method: 'DELETE' });
		await invalidateAll();
	}

	async function handleCreateLink(expiresAt: string | null) {
		await api(`/organizations/${orgId}/invite-links`, {
			method: 'POST',
			body: { expires_at: expiresAt }
		});
		await invalidateAll();
	}

	async function handleRevokeLink(id: string) {
		await api(`/invite-links/${encodeURIComponent(id)}`, { method: 'DELETE' });
		await invalidateAll();
	}

	async function handleToggleSlugInvite(enabled: boolean) {
		await api(`/organizations/${orgId}/slug-invite`, { method: 'PUT', body: { enabled } });
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Members | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<MembersPage
	members={data.members}
	totalCount={data.totalCount}
	page={data.page}
	pageSize={data.pageSize}
	roles={data.roles}
	canRemoveMembers={data.canRemoveMembers}
	canManageRoles={data.canManageRoles}
	canInvite={data.canInvite}
	inviteLinks={data.inviteLinks}
	slugInviteEnabled={data.slugInviteEnabled}
	{orgSlug}
	onRemove={handleRemove}
	onAssignRole={handleAssignRole}
	onCreateLink={handleCreateLink}
	onRevokeLink={handleRevokeLink}
	onToggleSlugInvite={handleToggleSlugInvite}
/>
