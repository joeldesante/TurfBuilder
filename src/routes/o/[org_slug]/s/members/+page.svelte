<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import MembersPage from '$pages/orgs/members/MembersPage.svelte';

	const { data } = $props();
	const orgSlug = $derived($page.params.org_slug);

	async function handleRemove(userId: string) {
		const res = await fetch(`/o/${orgSlug}/s/api/members/${userId}`, { method: 'DELETE' });
		if (!res.ok) {
			const body = await res.json();
			throw new Error(body.error ?? 'Failed to remove member.');
		}
		await invalidateAll();
	}

	async function handleCreateLink(expiresAt: string | null) {
		const res = await fetch(`/o/${orgSlug}/s/api/invite-links`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ expires_at: expiresAt })
		});
		if (!res.ok) {
			const body = await res.json();
			throw new Error(body.error ?? 'Failed to generate invite link.');
		}
		await invalidateAll();
	}

	async function handleRevokeLink(id: string) {
		const res = await fetch(`/o/${orgSlug}/s/api/invite-links/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			const body = await res.json();
			throw new Error(body.error ?? 'Failed to revoke invite link.');
		}
		await invalidateAll();
	}

	async function handleToggleSlugInvite(enabled: boolean) {
		const res = await fetch(`/o/${orgSlug}/s/api/invite-links/slug`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ enabled })
		});
		if (!res.ok) {
			const body = await res.json();
			throw new Error(body.error ?? 'Failed to update slug invite.');
		}
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Members | {data.config.application_name}</title>
</svelte:head>

<MembersPage
	members={data.members}
	canRemoveMembers={data.canRemoveMembers}
	isOwner={data.isOwner}
	inviteLinks={data.inviteLinks}
	slugInviteEnabled={data.slugInviteEnabled}
	orgSlug={orgSlug}
	onRemove={handleRemove}
	onCreateLink={handleCreateLink}
	onRevokeLink={handleRevokeLink}
	onToggleSlugInvite={handleToggleSlugInvite}
/>
