<script lang="ts">
	import { page } from '$app/stores';
	import { authClient } from '$lib/client';
	import { themeStore } from '$lib/theme.svelte';
	import Sidebar from '$components/layout/sidebar/Sidebar.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import ListIcon from 'phosphor-svelte/lib/List';
	import { buildInfraNav } from './sidebar-nav';

	const { children, data } = $props<{
		children: () => any;
		data: { user: { name: string }; infraPermissions: string[] };
	}>();

	let mobileOpen = $state(false);

	async function logout() {
		await authClient.signOut();
		location.href = '/auth/signin/';
	}

	const nav = $derived(buildInfraNav(data.infraPermissions));
</script>

<svelte:head>
	<title>Infrastructure | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<div class="flex h-dvh">
	<Sidebar
		{nav}
		currentPath={$page.url.pathname}
		username={data.user.name}
		theme={themeStore.theme}
		onthemechange={themeStore.setTheme}
		bind:mobileOpen
		onsignout={logout}
	/>

	<main class="flex-1 flex flex-col bg-surface overflow-hidden">
		<div class="md:hidden flex items-center px-4 pt-3 pb-1">
			<Button variant="ghost" iconOnly aria-label="Open menu" onclick={() => (mobileOpen = true)}>
				<ListIcon />
			</Button>
		</div>
		<div class="flex-1 overflow-y-auto px-5 pb-5">
			{@render children()}
		</div>
	</main>
</div>
