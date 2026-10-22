<script lang="ts">
	import { page } from '$app/state';
	import { authClient } from '$lib/client';
	import { themeStore } from '$lib/theme.svelte';
	import InfraShell from '$pages/infra/InfraShell.svelte';

	const { children, data } = $props();

	async function logout() {
		await authClient.signOut();
		location.href = '/auth/signin/';
	}
</script>

<svelte:head>
	<title>Infrastructure | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<InfraShell
	groups={data.infraMenu?.groups ?? []}
	currentPath={page.url.pathname}
	username={data.user.name}
	applicationName={data.config?.application_name ?? 'TurfBuilder'}
	theme={themeStore.theme}
	onthemechange={themeStore.setTheme}
	onsignout={logout}
>
	{@render children()}
</InfraShell>
