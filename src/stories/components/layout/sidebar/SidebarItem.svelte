<script lang="ts">
	import type { SidebarNavItem } from './types';

	interface Props {
		item: SidebarNavItem;
		active?: boolean;
		collapsed?: boolean;
		class?: string;
		[key: string]: unknown;
	}

	let {
		item,
		active = false,
		collapsed = false,
		class: className = '',
		...restProps
	}: Props = $props();

	let computedClass = $derived(
		[
			'flex items-center gap-3 px-3 h-10 md:h-9 rounded-lg text-sm no-underline',
			'transition-colors duration-150 [&>svg]:size-5',
			active
				? 'bg-primary-container text-on-primary-container font-medium'
				: 'text-on-surface-subtle hover:bg-surface-container hover:text-on-surface',
			collapsed ? 'justify-center px-0' : '',
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<a
	href={item.href}
	class={computedClass}
	aria-current={active ? 'page' : undefined}
	title={collapsed ? item.label : undefined}
	{...restProps}
>
	{#if item.icon}
		{@const Icon = item.icon}
		<Icon />
	{/if}
	{#if !collapsed}
		<span>{item.label}</span>
	{/if}
</a>
