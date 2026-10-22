<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { CubeIcon, SunIcon, MoonIcon, DesktopIcon } from 'phosphor-svelte';
	import { themeStore } from '$lib/theme.svelte';
	import DropdownMenu from '$components/actions/dropdown-menu/DropdownMenu.svelte';
	import type { DropdownMenuEntry } from '$components/actions/dropdown-menu/DropdownMenu.svelte';
	import Toaster from '$components/feedback/toaster/Toaster.svelte';
	import InfraQuickMenu from '$components/actions/infra-quick-menu/InfraQuickMenu.svelte';
	import ImpersonationBanner from '$components/feedback/impersonation-banner/ImpersonationBanner.svelte';
	import { page } from '$app/state';
	import { api } from '$lib/client/api';
	import { afterNavigate } from '$app/navigation';
	import { startAnalytics, identify, trackPageview } from '$lib/client/analytics';
	let { children, data } = $props();

	// Does nothing unless analytics is turned on in the infra dashboard.
	$effect(() => {
		const config = data.analytics;
		const userId = data.analyticsUserId;
		void startAnalytics(config).then(() => identify(userId));
	});

	afterNavigate(() => trackPageview(page.route.id));

	async function stopImpersonating() {
		const { userId } = await api<{ userId: string }>('/impersonations/current', { method: 'DELETE' });
		// A full load, so every layout picks up the admin's own session again.
		location.href = `/infra/users/${userId}`;
	}

	// data.infraMenu is only sent to infra admins. The infra panel has its own
	// sidebar, and auth, setup, and print pages stay uncluttered.
	const showInfraMenu = $derived(
		!/^\/(infra|auth|setup)(\/|$)/.test(page.url.pathname) && !page.url.pathname.includes('/print')
	);

	onMount(() => {
		document.body.dataset.hydrated = 'true';
		return themeStore.init();
	});

	const devMenuItems = $derived<DropdownMenuEntry[]>([
		{
			label: 'Light',
			icon: SunIcon,
			onclick: () => themeStore.setTheme('light'),
			active: themeStore.theme === 'light'
		},
		{
			label: 'Dark',
			icon: MoonIcon,
			onclick: () => themeStore.setTheme('dark'),
			active: themeStore.theme === 'dark'
		},
		{
			label: 'System',
			icon: DesktopIcon,
			onclick: () => themeStore.setTheme('system'),
			active: themeStore.theme === 'system'
		}
	]);
</script>

<svelte:head>
	<title>{data.config?.application_name ?? 'TurfBuilder'}</title>

	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta
		name="apple-mobile-web-app-title"
		content={data.config?.application_name ?? 'TurfBuilder'}
	/>
	<link rel="apple-touch-icon" href={'/turf_builder_app_icon.png'} />

	{#if data.config?.header_content}
		{@html data.config.header_content}
	{/if}
</svelte:head>
<!--
{#if process.env.NODE_ENV?.toLowerCase() !== 'production'}
	<div class="fixed bottom-0 right-0 m-1 z-50">
		<DropdownMenu items={devMenuItems} side="top" align="end">
			{#snippet children()}
				<div
					title="This instance is not running in production mode!"
					class="rounded-full bg-orange-500 font-bold text-xs p-1 px-2 flex flex-row gap-1 items-center select-none shadow text-white cursor-pointer"
				>
					<CubeIcon weight="fill" />
					DEV
				</div>
			{/snippet}
		</DropdownMenu>
	</div>
{/if}
-->

{#if data.impersonating}
	<ImpersonationBanner userName={data.impersonating.userName} onstop={stopImpersonating} />
{/if}

{@render children()}

{#if data.infraMenu && showInfraMenu}
	<InfraQuickMenu groups={data.infraMenu.groups} currentOrg={page.data.organization ?? null} />
{/if}

<Toaster />
