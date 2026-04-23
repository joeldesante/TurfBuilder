<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { CubeIcon } from 'phosphor-svelte';
	import SignOutIcon from 'phosphor-svelte/lib/SignOut';
	import SunIcon from 'phosphor-svelte/lib/Sun';
	import MoonIcon from 'phosphor-svelte/lib/Moon';
	import DesktopIcon from 'phosphor-svelte/lib/Desktop';
	import { authClient } from '$lib/client';
	import { themeStore } from '$lib/theme.svelte';
	import Avatar from '$components/data-display/avatar/Avatar.svelte';
	import AppDropdownMenu from '$components/actions/dropdown-menu/DropdownMenu.svelte';
	import type { DropdownMenuEntry } from '$components/actions/dropdown-menu/DropdownMenu.svelte';

	let { children, data } = $props();

	const session = authClient.useSession();

	onMount(() => themeStore.init());

	async function logout() {
		await authClient.signOut();
		location.href = '/auth/signin/';
	}

	type Theme = 'light' | 'dark' | 'system';

	const themeIcons: Record<Theme, typeof SunIcon> = {
		light: SunIcon,
		dark: MoonIcon,
		system: DesktopIcon
	};

	let userMenuItems = $derived<DropdownMenuEntry[]>([
		...(['light', 'dark', 'system'] as Theme[]).map((t) => ({
			label: t.charAt(0).toUpperCase() + t.slice(1),
			icon: themeIcons[t],
			onclick: () => themeStore.setTheme(t),
			active: themeStore.theme === t
		})),
		{ separator: true as const },
		...(data.infraAccess
			? [{ label: 'Infrastructure', onclick: () => { location.href = '/infra'; } } as DropdownMenuEntry]
			: []),
		{ label: 'Sign Out', icon: SignOutIcon, onclick: logout }
	]);
</script>

<svelte:head>
	<title>{data.config?.application_name ?? 'TurfBuilder'}</title>

	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content={data.config?.application_name ?? 'TurfBuilder'} />
	<link rel="apple-touch-icon" href={'/turf_builder_app_icon.png'} />
</svelte:head>

{#if process.env.NODE_ENV?.toLowerCase() !== 'production'}
	<div
		title="This instance is not runnning in production mode!"
		class="absolute bottom-0 right-0 rounded-full bg-orange-500 font-bold text-xs p-1 px-2 m-1 flex flex-row gap-1 items-center select-none shadow z-50"
	>
		<CubeIcon weight="fill" />
		DEV
	</div>
{/if}

{#if $session.data?.user.role === 'user'}
	<div class="fixed top-4 right-4 z-9999">
		<AppDropdownMenu items={userMenuItems} side="bottom" align="end" sideOffset={8}>
			{#snippet children()}
				<Avatar username={$session.data?.user.name ?? $session.data?.user.email ?? '?'} />
			{/snippet}
		</AppDropdownMenu>
	</div>
{/if}

{@render children()}
