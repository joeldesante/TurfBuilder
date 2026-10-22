<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { api } from '$lib/client/api';
	import LineChart from '$components/data-display/charts/LineChart/LineChart.svelte';
	import InfraUserDetailPage, { type UserActions } from '$pages/infra/users/InfraUserDetailPage.svelte';

	const { data } = $props();

	const base = $derived(`/users/${data.target.id}`);

	/** Runs a request, then refreshes the page's data and confirms with a toast. */
	async function act(request: () => Promise<unknown>, done: string) {
		await request();
		await invalidateAll();
		toast.success(done);
	}

	const actions: UserActions = {
		update: (input) => act(() => api(base, { method: 'PATCH', body: input }), 'Details saved.'),
		sendPasswordReset: () => act(() => api(`${base}/password-resets`, { method: 'POST' }), 'Password reset email sent.'),
		sendVerification: () =>
			act(() => api(`${base}/verification-emails`, { method: 'POST' }), 'Verification email sent.'),
		resetTwoFactor: () => act(() => api(`${base}/two-factor`, { method: 'DELETE' }), 'Two-factor sign-in turned off.'),
		suspend: (input) => act(() => api(`${base}/suspension`, { method: 'PUT', body: input }), 'User suspended.'),
		unsuspend: () => act(() => api(`${base}/suspension`, { method: 'DELETE' }), 'Suspension lifted.'),
		revokeSessions: () => act(() => api(`${base}/sessions`, { method: 'DELETE' }), 'Signed out everywhere.'),
		revokeSession: (sessionId) => act(() => api(`/sessions/${sessionId}`, { method: 'DELETE' }), 'Session ended.'),
		impersonate: async () => {
			await api(`${base}/impersonations`, { method: 'POST' });
			// A full load, so every layout picks up the new session.
			location.href = '/';
		},
		remove: async (confirmEmail) => {
			await api(base, { method: 'DELETE', body: { confirmEmail } });
			toast.success('Account deleted.');
			await goto('/infra/users');
		}
	};
</script>

<svelte:head><title>{data.target.name} | Users | Infrastructure</title></svelte:head>

<InfraUserDetailPage
	user={data.target}
	tab={data.tab}
	memberships={data.memberships}
	sessions={data.sessions}
	activity={data.activity}
	emails={data.emails}
	audit={data.audit}
	permissions={data.infraPermissions}
	currentUserId={data.user.id}
	{actions}
>
	{#snippet activityChart()}
		<LineChart
			class="mt-6"
			title="Activity"
			subtitle="Last 90 days, by week"
			series={data.activitySeries}
			granularity="week"
			csvFilename="user-activity"
		/>
	{/snippet}
</InfraUserDetailPage>
