<script lang="ts">
	import type { SidebarNavAccordion, SidebarNavItem } from './types';
	import SidebarItem from './SidebarItem.svelte';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDown';
	import { isNavActive } from './nav-utils';

	interface Props {
		accordion: SidebarNavAccordion;
		currentPath?: string;
		collapsed?: boolean;
		class?: string;
		[key: string]: unknown;
	}

	let {
		accordion,
		currentPath = '',
		collapsed = false,
		class: className = '',
		...restProps
	}: Props = $props();

	const { defaultOpen = true } = accordion;
	let open = $state(defaultOpen);

	let anyChildActive = $derived(accordion.items.some((item) => isNavActive(item.href, currentPath)));

	let triggerClass = $derived(
		[
			'flex items-center w-full px-3 h-10 md:h-9 rounded-lg text-sm cursor-pointer select-none',
			'transition-colors duration-150 [&>svg]:size-5',
			anyChildActive
				? 'text-on-surface font-medium'
				: 'text-on-surface-subtle hover:bg-surface-container hover:text-on-surface',
			collapsed ? 'justify-center px-0' : 'gap-3'
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<div class={className} {...restProps}>
	<button
		type="button"
		class={triggerClass}
		onclick={() => (open = !open)}
		aria-expanded={open}
		title={collapsed ? accordion.label : undefined}
	>
		{#if accordion.icon}
			{@const Icon = accordion.icon}
			<Icon />
		{/if}
		<span
			class="whitespace-nowrap overflow-hidden transition-[max-width] duration-200 flex-1 text-left {collapsed
				? 'max-w-0'
				: 'max-w-[200px]'}"
		>
			{accordion.label}
		</span>
		{#if !collapsed}
			<CaretDownIcon
				class="size-3.5 shrink-0 transition-transform duration-200 {open ? 'rotate-0' : '-rotate-90'}"
			/>
		{/if}
	</button>

	{#if open && !collapsed}
		<div class="mt-0.5 ml-3 pl-3 border-l border-outline-subtle flex flex-col gap-0.5">
			{#each accordion.items as item}
				<SidebarItem {item} active={isNavActive(item.href, currentPath)} {collapsed} />
			{/each}
		</div>
	{/if}
</div>
