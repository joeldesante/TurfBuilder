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
	type Theme = 'light' | 'dark' | 'system';

	interface Props {
		nav: SidebarNavEntry[];
		currentPath?: string;
		collapsed?: boolean;
		mobileOpen?: boolean;
		username?: string;
		applicationName?: string;
		infraAccess?: boolean;
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
		applicationName = 'TurfBuilder',
		infraAccess = false,
		theme = 'system',
		onsignout,
		onthemechange,
		class: className = '',
		...restProps
	}: Props = $props();

	function allNavHrefs(): string[] {
		return nav.flatMap((entry) => {
			if (entry.kind === 'item') return [entry.item.href];
			if (entry.kind === 'section') return entry.section.items.map((i) => i.href);
			return [];
		});
	}

	function isActive(href: string): boolean {
		const normHref = href.endsWith('/') ? href : href + '/';
		const normPath = currentPath.endsWith('/') ? currentPath : currentPath + '/';

		// Use exact match if this href is a prefix of any sibling nav href,
		// so a root item (e.g. /o/foo/s/) isn't permanently active on sub-pages.
		const isPrefixOfSibling = allNavHrefs().some((other) => {
			const normOther = other.endsWith('/') ? other : other + '/';
			return normOther !== normHref && normOther.startsWith(normHref);
		});

		if (isPrefixOfSibling) {
			return normPath === normHref;
		}
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
		system: DesktopIcon
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
			active: theme === t
		})),
		{ separator: true as const },
		{ label: 'Sign Out', icon: SignOutIcon, onclick: onsignout }
	]);
</script>

<!-- Mobile backdrop -->
{#if mobileOpen}
	<div
		class="fixed inset-0 z-40 bg-scrim md:hidden"
		aria-hidden="true"
		onclick={() => (mobileOpen = false)}
	></div>
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
			<span class="pl-4 text-sm font-semibold text-on-surface truncate"
				>{applicationName}</span
			>
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
			<Button variant="ghost" iconOnly aria-label="Close menu" onclick={() => (mobileOpen = false)}>
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

	<!-- Infra link -->
	{#if infraAccess}
		<div class="shrink-0 px-2 pb-1">
			<a
				href="/infra"
				class="flex items-center gap-3 w-full px-3 h-9 rounded-lg text-sm
					text-on-surface-subtle hover:bg-surface-container hover:text-on-surface transition-colors"
				title={collapsed ? 'Infrastructure' : undefined}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 256 256" fill="currentColor">
					<path d="M216,130.16q.06-2.16,0-4.32l14.92-18.49a8,8,0,0,0,1.48-7.06,107.6,107.6,0,0,0-10.59-25.59,8,8,0,0,0-6.3-3.93l-23.72-2.64q-1.56-1.56-3.18-3.06L186,42.38a8,8,0,0,0-3.93-6.3,107.29,107.29,0,0,0-25.59-10.6,8,8,0,0,0-7.06,1.49L131,42a92.26,92.26,0,0,0-4.32,0L108.54,27a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,75.89,36.1a8,8,0,0,0-3.93,6.3L69.32,66.13q-1.56,1.56-3.06,3.18L42.38,71a8,8,0,0,0-6.3,3.93,107.29,107.29,0,0,0-10.6,25.59,8,8,0,0,0,1.49,7.06L42,125.84q-.06,2.16,0,4.32L27.05,148.65a8,8,0,0,0-1.48,7.06,107.6,107.6,0,0,0,10.59,25.59,8,8,0,0,0,6.3,3.93l23.72,2.64q1.56,1.56,3.18,3.06L71,213.62a8,8,0,0,0,3.93,6.3,107.29,107.29,0,0,0,25.59,10.6,8,8,0,0,0,7.06-1.49L125,214a92.26,92.26,0,0,0,4.32,0l18.49,14.92a8,8,0,0,0,7.06,1.48,107.6,107.6,0,0,0,25.59-10.59,8,8,0,0,0,3.93-6.3l2.64-23.72q1.56-1.56,3.06-3.18l23.88-1.68a8,8,0,0,0,6.3-3.93,107.29,107.29,0,0,0,10.6-25.59,8,8,0,0,0-1.49-7.06ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z"/>
				</svg>
				{#if !collapsed}
					<span>Infrastructure</span>
				{/if}
			</a>
		</div>
	{/if}

	<!-- User menu -->
	<div class="shrink-0 border-t border-outline-subtle px-2 py-3">
		<AppDropdownMenu items={userMenuItems} side="top" align="start" sideOffset={8}>
			{#snippet children()}
				<div class={userTriggerClass} title={collapsed ? username : undefined}>
					<Avatar {username} size="sm" />
					{#if !collapsed}
						<span class="truncate text-sm font-medium">{username}</span>
					{/if}
				</div>
			{/snippet}
		</AppDropdownMenu>
	</div>
</nav>
