<script lang="ts">
	import type { SidebarNavEntry } from './types';
	import SidebarSection from './SidebarSection.svelte';
	import SidebarItem from './SidebarItem.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Avatar from '$components/data-display/avatar/Avatar.svelte';
	import AppDropdownMenu from '$components/actions/dropdown-menu/DropdownMenu.svelte';
	import type { DropdownMenuEntry } from '$components/actions/dropdown-menu/DropdownMenu.svelte';
	import SignOutIcon from 'phosphor-svelte/lib/SignOut';
	import SunIcon from 'phosphor-svelte/lib/Sun';
	import MoonIcon from 'phosphor-svelte/lib/Moon';
	import DesktopIcon from 'phosphor-svelte/lib/Desktop';
	import SidebarSimpleIcon from 'phosphor-svelte/lib/SidebarSimpleIcon';
	import XIcon from 'phosphor-svelte/lib/X';
	import config from '$lib/../config';

	type Theme = 'light' | 'dark' | 'system';

	interface Props {
		nav: SidebarNavEntry[];
		currentPath?: string;
		collapsed?: boolean;
		mobileOpen?: boolean;
		username?: string;
		theme?: Theme;
		onsignout?: () => void;
		onthemechange?: (theme: Theme) => void;
		class?: string;
		[key: string]: unknown;
	}

	let {
		nav,
		currentPath = '',
		collapsed = $bindable(false),
		mobileOpen = $bindable(false),
		username = 'User',
		theme = 'system',
		onsignout,
		onthemechange,
		class: className = '',
		...restProps
	}: Props = $props();

	function isActive(href: string): boolean {
		const normHref = href.endsWith('/') ? href : href + '/';
		const normPath = currentPath.endsWith('/') ? currentPath : currentPath + '/';

		// Exact match for dashboard root
		if (normHref === '/system/') {
			return normPath === '/system/';
		}
		// Prefix match for everything else
		return normPath.startsWith(normHref);
	}

	// Close mobile sidebar on navigation
	let prevPath = $state(currentPath);
	$effect(() => {
		if (currentPath !== prevPath) {
			mobileOpen = false;
			prevPath = currentPath;
		}
	});

	let sidebarClass = $derived(
		[
			'flex flex-col bg-surface-container-lowest h-dvh border-r border-outline-subtle overflow-hidden',
			// Mobile: fixed overlay, slide in/out
			'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50',
			mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
			'max-md:transition-transform max-md:duration-200 max-md:ease-in-out',
			// Width
			collapsed ? 'md:w-16' : 'md:w-[250px]',
			'max-md:w-[280px]',
			'md:transition-[width] md:duration-200',
			className
		]
			.filter(Boolean)
			.join(' ')
	);

	const themeIcons: Record<Theme, typeof SunIcon> = {
		light: SunIcon,
		dark: MoonIcon,
		system: DesktopIcon,
	};

	let userTriggerClass = $derived(
		[
			'flex items-center gap-3 w-full px-3 h-10 md:h-9 rounded-lg',
			'text-on-surface hover:bg-surface-container',
			'transition-colors duration-150 cursor-pointer',
			collapsed ? 'justify-center px-0' : ''
		]
			.filter(Boolean)
			.join(' ')
	);

	let userMenuItems = $derived<DropdownMenuEntry[]>([
		...(['light', 'dark', 'system'] as Theme[]).map((t) => ({
			label: t.charAt(0).toUpperCase() + t.slice(1),
			icon: themeIcons[t],
			onclick: () => onthemechange?.(t),
			active: theme === t,
		})),
		{ separator: true as const },
		{ label: 'Sign Out', icon: SignOutIcon, onclick: onsignout },
	])
</script>

<!-- Mobile backdrop -->
{#if mobileOpen}
	<div class="fixed inset-0 z-40 bg-scrim md:hidden" aria-hidden="true" onclick={() => (mobileOpen = false)}></div>
{/if}

<!-- Sidebar -->
<nav
	aria-label="System navigation"
	class={sidebarClass}
	onkeydown={(e) => e.key === 'Escape' && (mobileOpen = false)}
	{...restProps}
>
	<!-- Top bar: collapse toggle (desktop) / close button (mobile) -->
	<div class="flex items-center shrink-0 px-2 pt-3 pb-1">
		{#if !collapsed}
			<span class="pl-4 text-sm font-semibold text-on-surface truncate">{config.application_name}</span>
		{/if}
		<div class="hidden md:block {collapsed ? 'mx-auto' : 'ml-auto'}">
			<Button
				variant="ghost"
				iconOnly
				aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				onclick={() => (collapsed = !collapsed)}
				class="text-on-surface-subtle hover:text-on-surface"
			>
				<SidebarSimpleIcon />
			</Button>
		</div>
		<div class="flex md:hidden ml-auto">
			<Button
				variant="ghost"
				iconOnly
				aria-label="Close menu"
				onclick={() => (mobileOpen = false)}
			>
				<XIcon />
			</Button>
		</div>
	</div>

	<!-- Navigation items -->
	<div class="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1">
		<div class="flex flex-col gap-1">
			{#each nav as entry}
				{#if entry.kind === 'item'}
					<SidebarItem item={entry.item} active={isActive(entry.item.href)} {collapsed} />
				{:else}
					<SidebarSection section={entry.section} {currentPath} {collapsed} />
				{/if}
			{/each}
		</div>
	</div>

	<!-- User menu -->
	<div class="shrink-0 border-t border-outline-subtle px-2 py-3">
		<AppDropdownMenu items={userMenuItems} side="top" align="start" sideOffset={8}>
			{#snippet children()}
				<button class={userTriggerClass} title={collapsed ? username : undefined}>
					<Avatar {username} size="sm" />
					{#if !collapsed}
						<span class="truncate text-sm font-medium">{username}</span>
					{/if}
				</button>
			{/snippet}
		</AppDropdownMenu>
	</div>
</nav>
