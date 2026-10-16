<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import type { Snippet, Component } from 'svelte';

	export interface DropdownMenuItem {
		label: string;
		icon?: Component;
		onclick?: () => void;
		href?: string;
		disabled?: boolean;
		variant?: 'default' | 'destructive';
		active?: boolean;
	}

	export type DropdownMenuEntry = DropdownMenuItem | { separator: true };

	interface Props {
		/** What the default trigger button shows. Must not contain a button of its own; use `trigger` for that. */
		children?: Snippet;
		/**
		 * Renders the trigger yourself: spread `props` onto your own button (`<Button {...props}>`) and it
		 * becomes the trigger. Use this whenever the trigger is a button, since a button cannot sit
		 * inside the default trigger, which is a button too.
		 */
		trigger?: Snippet<[Record<string, unknown>]>;
		items: DropdownMenuEntry[];
		open?: boolean;
		align?: 'start' | 'center' | 'end';
		side?: 'top' | 'bottom' | 'left' | 'right';
		sideOffset?: number;
		class?: string;
	}

	let {
		children,
		trigger,
		items,
		open = $bindable(false),
		align = 'end',
		side = 'bottom',
		sideOffset = 4,
		class: className = ''
	}: Props = $props();

	type Variant = 'default' | 'destructive';

	const itemVariantClasses: Record<Variant, string> = {
		default: 'text-on-surface data-[highlighted]:bg-surface-container-high',
		destructive: 'text-error data-[highlighted]:bg-error/10'
	};

	const itemBaseClasses =
		'flex items-center gap-2 px-3 h-9 w-full rounded-md text-sm cursor-pointer outline-none no-underline select-none [&>svg]:size-4 [&>svg]:shrink-0 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed data-[disabled]:pointer-events-none';

	function itemClass(item: DropdownMenuItem) {
		return [
			itemBaseClasses,
			itemVariantClasses[item.variant ?? 'default'],
			item.active ? 'bg-surface-container' : ''
		]
			.filter(Boolean)
			.join(' ');
	}
</script>

<DropdownMenu.Root bind:open>
	{#if trigger}
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				{@render trigger(props)}
			{/snippet}
		</DropdownMenu.Trigger>
	{:else}
		<DropdownMenu.Trigger class="w-full">
			{@render children?.()}
		</DropdownMenu.Trigger>
	{/if}
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			{side}
			{align}
			{sideOffset}
			class={[
				'z-50 min-w-48 rounded-lg border border-outline-subtle bg-surface p-1 shadow-md outline-none',
				className
			]
				.filter(Boolean)
				.join(' ')}
		>
			{#each items as item}
				{#if 'separator' in item}
					<DropdownMenu.Separator class="my-1 h-px bg-outline-subtle mx-1" />
				{:else if item.href}
					<DropdownMenu.Item disabled={item.disabled} class={itemClass(item)}>
						{#snippet child({ props })}
							<a href={item.href} {...props}>
								{#if item.icon}
									{@const Icon = item.icon}
									<Icon />
								{/if}
								{item.label}
							</a>
						{/snippet}
					</DropdownMenu.Item>
				{:else}
					<DropdownMenu.Item
						disabled={item.disabled}
						onclick={item.onclick}
						class={itemClass(item)}
					>
						{#if item.icon}
							{@const Icon = item.icon}
							<Icon />
						{/if}
						{item.label}
					</DropdownMenu.Item>
				{/if}
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
