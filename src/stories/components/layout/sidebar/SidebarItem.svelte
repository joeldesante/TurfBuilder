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
			'flex items-center px-3 h-10 md:h-9 rounded-lg text-sm no-underline',
			'transition-colors duration-150 [&>svg]:size-5',
			active
				? 'bg-primary-container dark:bg-primary-container/50 text-on-primary-container font-medium'
				: 'text-on-surface-subtle hover:bg-surface-container hover:text-on-surface',
			collapsed ? 'justify-center px-0' : 'gap-3',
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
	<span class="whitespace-nowrap overflow-hidden transition-[max-width] duration-200 {collapsed ? 'max-w-0' : 'max-w-[200px]'}">{item.label}</span>
</a>
