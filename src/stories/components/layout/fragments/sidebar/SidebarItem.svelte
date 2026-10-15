<script lang="ts">
	import type { SidebarNavItem } from './types';
	import { compactNumber } from '$lib/shared/utils/compact-number';

	interface Props {
		/** Pass an `onclick` instead of an `href` to render a button with the same look. */
		item: Omit<SidebarNavItem, 'href'> & { href?: string };
		onclick?: (event: MouseEvent) => void;
		active?: boolean;
		collapsed?: boolean;
		class?: string;
		[key: string]: unknown;
	}

	let {
		item,
		onclick,
		active = false,
		collapsed = false,
		class: className = '',
		...restProps
	}: Props = $props();

	let computedClass = $derived(
		[
			'flex items-center px-3 h-10 md:h-9 rounded-lg text-sm no-underline',
			'transition-colors duration-150 [&>svg]:size-5',
			onclick ? 'w-full cursor-pointer text-left' : '',
			active
				? 'bg-primary text-on-primary font-medium'
				: 'text-on-surface-subtle hover:bg-surface-container hover:text-on-surface',
			collapsed ? 'justify-center px-0' : 'gap-3',
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

{#snippet content()}
	{#if item.icon}
		{@const Icon = item.icon}
		<Icon />
	{/if}
	<span
		class="whitespace-nowrap overflow-hidden transition-[max-width] duration-200 {collapsed
			? 'max-w-0'
			: 'max-w-[200px]'}">{item.label}</span
	>
	{#if item.badge !== undefined && !collapsed}
		{@const description = [item.badge.toLocaleString(), item.badgeLabel].filter(Boolean).join(' ')}
		<span
			aria-hidden="true"
			title={description}
			class="ml-auto rounded-full px-2 py-0.5 text-xs font-medium tabular-nums {active
				? 'bg-on-primary/15 text-on-primary'
				: 'bg-surface-container text-on-surface border border-outline'}"
			>{compactNumber(item.badge)}</span
		>
		<span class="sr-only">{description}</span>
	{/if}
{/snippet}

{#if onclick}
	<button
		type="button"
		class={computedClass}
		aria-current={active ? 'true' : undefined}
		title={collapsed ? item.label : undefined}
		{onclick}
		{...restProps}
	>
		{@render content()}
	</button>
{:else}
	<a
		href={item.href}
		class={computedClass}
		aria-current={active ? 'page' : undefined}
		title={collapsed ? item.label : undefined}
		{...restProps}
	>
		{@render content()}
	</a>
{/if}
