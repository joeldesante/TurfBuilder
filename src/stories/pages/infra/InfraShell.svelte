<script lang="ts">
	import type { Snippet } from 'svelte';
	import Sidebar from '$components/layout/fragments/sidebar/Sidebar.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import ListIcon from 'phosphor-svelte/lib/List';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeft';
	import type { SidebarNavEntry } from '$components/layout/fragments/sidebar/types';
	import { INFRA_NAV_ICONS } from '$components/layout/fragments/infra-nav/icons';
	import type { InfraNavGroup } from '$lib/shared/utils/infra-nav';

	type Theme = 'light' | 'dark' | 'system';

	interface Props {
		groups: InfraNavGroup[];
		currentPath: string;
		username: string;
		applicationName?: string;
		theme?: Theme;
		onthemechange?: (theme: Theme) => void;
		onsignout?: () => void;
		children: Snippet;
	}

	let {
		groups,
		currentPath,
		username,
		applicationName = 'TurfBuilder',
		theme = 'system',
		onthemechange,
		onsignout,
		children
	}: Props = $props();

	let mobileOpen = $state(false);

	const nav = $derived<SidebarNavEntry[]>([
		{ kind: 'item', item: { label: 'Back to the app', href: '/', icon: ArrowLeftIcon } },
		...groups.flatMap((group): SidebarNavEntry[] => {
			const items = group.links.map((link) => ({
				label: link.label,
				href: link.href,
				icon: INFRA_NAV_ICONS[link.icon],
				external: link.external
			}));
			return group.label
				? [{ kind: 'section', section: { label: group.label, items } }]
				: items.map((item) => ({ kind: 'item', item }));
		})
	]);
</script>

<div class="flex h-dvh">
	<Sidebar
		{nav}
		{currentPath}
		{username}
		{applicationName}
		{theme}
		{onthemechange}
		{onsignout}
		bind:mobileOpen
	/>

	<main class="relative flex-1 flex flex-col bg-surface overflow-hidden">
		<div class="md:hidden flex items-center px-4 pt-3 pb-1">
			<Button variant="ghost" iconOnly aria-label="Open menu" onclick={() => (mobileOpen = true)}>
				<ListIcon />
			</Button>
		</div>
		<!-- Positioned, so absolute descendants (sr-only text, tooltips) are clipped and
		     scrolled here. Unpositioned, Firefox sizes the document by them, and the page
		     scrolls on past the shell. -->
		<div class="relative flex-1 overflow-y-auto px-4 pb-8 md:px-6">
			{@render children()}
		</div>
	</main>
</div>
