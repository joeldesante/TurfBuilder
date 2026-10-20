<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { api } from '$lib/client/api';
	import InfraOrgDetailPage, { type OrgActions } from '$pages/infra/orgs/InfraOrgDetailPage.svelte';

	const { data } = $props();

	const base = $derived(`/organizations/${data.org.id}`);

	/** Runs a request, then refreshes the page's data and confirms with a toast. */
	async function act(request: () => Promise<unknown>, done: string) {
		await request();
		await invalidateAll();
		toast.success(done);
	}

	const actions: OrgActions = {
		suspend: (reason) => act(() => api(`${base}/suspension`, { method: 'PUT', body: { reason } }), 'Organization suspended.'),
		unsuspend: () => act(() => api(`${base}/suspension`, { method: 'DELETE' }), 'Suspension lifted.'),
		transferOwnership: (memberId) =>
			act(() => api(`${base}/ownership`, { method: 'PUT', body: { memberId } }), 'Ownership transferred.'),
		remove: async (confirmSlug) => {
			await api(base, { method: 'DELETE', body: { confirmSlug } });
			toast.success('Organization deleted.');
			await goto('/infra/orgs');
		},
		restore: () => act(() => api(`${base}/restorations`, { method: 'POST' }), 'Organization restored.'),
		removeMember: (memberId) => act(() => api(`/members/${memberId}`, { method: 'DELETE' }), 'Member removed.'),
		cancelInvitation: (id) => act(() => api(`/invitations/${id}`, { method: 'DELETE' }), 'Invitation cancelled.'),
		revokeLink: (id) => act(() => api(`/invite-links/${id}`, { method: 'DELETE' }), 'Invite link turned off.')
	};
</script>

<svelte:head><title>{data.org.name} | Organizations | Infrastructure</title></svelte:head>

<InfraOrgDetailPage
	org={data.org}
	tab={data.tab}
	members={data.members}
	invitations={data.invitations}
	activity={data.activity}
	audit={data.audit}
	activitySeries={data.activitySeries}
	permissions={data.infraPermissions}
	{actions}
/>
