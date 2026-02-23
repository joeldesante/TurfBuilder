<script lang="ts">
	import { Collapsible } from 'bits-ui';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDown';
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

	let hasActiveChild = $derived(section.items.some((item) => isActive(item.href)));

	let open = $state(false);

	$effect(() => {
		if (hasActiveChild) open = true;
	});

	let triggerClass = $derived(
		[
			'flex items-center gap-3 w-full px-3 h-10 md:h-9 rounded-lg text-sm',
			'font-semibold text-on-surface hover:bg-surface-container',
			'transition-colors duration-150 cursor-pointer [&>svg]:size-5',
			collapsed ? 'justify-center px-0' : '',
			hasActiveChild && collapsed ? 'text-primary' : '',
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<Collapsible.Root bind:open {...restProps}>
	<Collapsible.Trigger class={triggerClass}>
		{#if section.icon}
			{@const Icon = section.icon}
			<Icon />
		{/if}
		{#if !collapsed}
			<span class="flex-1 text-left">{section.label}</span>
			<CaretDownIcon
				class="size-4 transition-transform duration-200 {open ? 'rotate-0' : '-rotate-90'}"
			/>
		{/if}
	</Collapsible.Trigger>

	{#if !collapsed}
		<Collapsible.Content
			class="overflow-hidden pl-3"
			style="transition: height 200ms ease-out;"
		>
			<div class="flex flex-col gap-0.5 pt-0.5">
				{#each section.items as item}
					<SidebarItem {item} active={isActive(item.href)} {collapsed} />
				{/each}
			</div>
		</Collapsible.Content>
	{/if}
</Collapsible.Root>
