<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import MembersPage from '$pages/o/s/members/MembersPage.svelte';
	import { toast } from 'svelte-sonner';
	import { api, errorMessage } from '$lib/client/api';

	const { data } = $props();
	const orgSlug = $derived($page.params.org_slug!);
	const orgId = $derived(data.organization.id);

	/** The page names members by user id; the API addresses the membership. */
	function memberId(userId: string): string {
		const member = data.members.find((m) => m.id === userId);
		if (!member) throw new Error('That member is no longer on this page.');
		return member.member_id;
	}

	// The members table does not show errors itself, so these report them as toasts.
	async function handleAssignRole(userId: string, roleId: string | null) {
		try {
			await api(`/members/${memberId(userId)}`, { method: 'PATCH', body: { role_id: roleId } });
			toast.success('Role updated.');
		} catch (e) {
			toast.error(errorMessage(e, 'The role could not be changed.'));
		}
		// Also after a failure, so the role picker shows the role that was kept.
		await invalidateAll();
	}

	async function handleRemove(userId: string) {
		try {
			await api(`/members/${memberId(userId)}`, { method: 'DELETE' });
			toast.success('Member removed.');
			await invalidateAll();
		} catch (e) {
			toast.error(errorMessage(e, 'The member could not be removed.'));
		}
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
