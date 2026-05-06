<script lang="ts">
	import type { SidebarNavSection, SidebarNavItem } from './types';
	import SidebarItem from './SidebarItem.svelte';
	import SidebarAccordionItem from './SidebarAccordionItem.svelte';
	import { isNavActive } from './nav-utils';

	interface Props {
		section: SidebarNavSection;
		currentPath?: string;
		collapsed?: boolean;
		class?: string;
		[key: string]: unknown;
	}

	let {
		section,
		currentPath = '',
		collapsed = false,
		class: className = '',
		...restProps
	}: Props = $props();

	function isNavItem(entry: SidebarNavSection['items'][number]): entry is SidebarNavItem {
		return 'href' in entry;
	}
</script>

<div class={className} {...restProps}>
	{#if !collapsed}
		<p class="px-3 pt-4 pb-1 text-xs text-on-surface-subtle">
			{section.label}
		</p>
	{/if}
	<div class="flex flex-col gap-0.5">
		{#each section.items as entry}
			{#if isNavItem(entry)}
				<SidebarItem item={entry} active={isNavActive(entry.href, currentPath)} {collapsed} />
			{:else}
				<SidebarAccordionItem accordion={entry} {currentPath} {collapsed} />
			{/if}
		{/each}
	</div>
</div>
