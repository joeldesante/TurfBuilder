<script lang="ts">
	import type { SidebarNavEntry } from './types';
	import SidebarSection from './SidebarSection.svelte';
	import SidebarItem from './SidebarItem.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import SignOutIcon from 'phosphor-svelte/lib/SignOut';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeft';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRight';
	import XIcon from 'phosphor-svelte/lib/X';

	interface Props {
		nav: SidebarNavEntry[];
		currentPath?: string;
		collapsed?: boolean;
		mobileOpen?: boolean;
		onsignout?: () => void;
		class?: string;
		[key: string]: unknown;
	}

	let {
		nav,
		currentPath = '',
		collapsed = $bindable(false),
		mobileOpen = $bindable(false),
		onsignout,
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
			'flex flex-col bg-surface-dim h-dvh border-r border-outline-subtle overflow-hidden',
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

	let signOutClass = $derived(
		[
			'flex items-center gap-3 w-full px-3 h-10 md:h-9 rounded-lg text-sm',
			'text-on-surface-subtle hover:bg-surface-container hover:text-on-surface',
			'transition-colors duration-150 cursor-pointer [&>svg]:size-5',
			collapsed ? 'justify-center px-0' : ''
		]
			.filter(Boolean)
			.join(' ')
	);
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
		<div class="hidden md:block ml-auto">
			<Button
				variant="ghost"
				iconOnly
				aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				onclick={() => (collapsed = !collapsed)}
			>
				{#if collapsed}
					<CaretRightIcon />
				{:else}
					<CaretLeftIcon />
				{/if}
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

	<!-- Sign out -->
	<div class="shrink-0 border-t border-outline-subtle px-2 py-3">
		<button type="button" onclick={onsignout} class={signOutClass} title={collapsed ? 'Sign Out' : undefined}>
			<SignOutIcon />
			{#if !collapsed}
				<span>Sign Out</span>
			{/if}
		</button>
	</div>
</nav>
