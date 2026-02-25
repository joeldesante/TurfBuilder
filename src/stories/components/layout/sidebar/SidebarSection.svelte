<script lang="ts">
	import type { SidebarNavSection } from './types';
	import SidebarItem from './SidebarItem.svelte';

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

	function isActive(href: string): boolean {
		return currentPath.startsWith(href);
	}
</script>

<div class={className} {...restProps}>
	{#if !collapsed}
		<p class="px-3 pt-4 pb-1 text-xs text-on-surface-subtle">
			{section.label}
		</p>
	{/if}
	<div class="flex flex-col gap-0.5">
		{#each section.items as item}
			<SidebarItem {item} active={isActive(item.href)} {collapsed} />
		{/each}
	</div>
</div>
