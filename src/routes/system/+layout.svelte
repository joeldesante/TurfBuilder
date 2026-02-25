<script lang="ts">
	import type { ApplicationConfig } from '../../config';
	import type { User } from 'better-auth';
	import { page } from '$app/stores';
	import { authClient } from '$lib/client';
	import Sidebar from '$components/layout/sidebar/Sidebar.svelte';
	import { systemNav } from './sidebar-nav';
	import Button from '$components/actions/button/Button.svelte';
	import ListIcon from 'phosphor-svelte/lib/List';

	const { children, title, data } = $props<{
		children: () => any;
		title?: string;
		data: {
			config: ApplicationConfig;
			user: User;
		};
	}>();

	let mobileOpen = $state(false);

	async function logout() {
		await authClient.signOut();
		location.href = '/auth/signin/';
	}
</script>

<svelte:head>
	<title>{title || 'Dashboard'} | {data.config.application_name}</title>
</svelte:head>

<div class="flex h-dvh">
	<Sidebar
		nav={systemNav}
		currentPath={$page.url.pathname}
		username={data.user.name}
		bind:mobileOpen
		onsignout={logout}
	/>

	<main class="flex-1 flex flex-col bg-surface overflow-hidden">
		<div class="flex items-center gap-3 px-5 pt-4 pb-2">
			<Button
				variant="ghost"
				iconOnly
				aria-label="Open menu"
				class="md:hidden"
				onclick={() => (mobileOpen = true)}
			>
				<ListIcon />
			</Button>
			<h1 class="text-2xl font-bold">{title ?? 'Dashboard'}</h1>
		</div>
		<div class="flex-1 overflow-y-auto px-5 pb-5">
			{@render children()}
		</div>
	</main>
</div>
