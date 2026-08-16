<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { CubeIcon, SunIcon, MoonIcon, DesktopIcon } from 'phosphor-svelte';
	import { themeStore } from '$lib/theme.svelte';
	import DropdownMenu from '$components/actions/dropdown-menu/DropdownMenu.svelte';
	import type { DropdownMenuEntry } from '$components/actions/dropdown-menu/DropdownMenu.svelte';
	let { children, data } = $props();

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

{@render children()}
