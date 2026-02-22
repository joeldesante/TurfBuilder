<script lang="ts">
	import { DropdownMenu } from 'bits-ui'
	import type { Snippet, Component } from 'svelte'

	export interface DropdownMenuItem {
		label: string
		icon?: Component
		onclick?: () => void
		href?: string
		disabled?: boolean
		variant?: 'default' | 'destructive'
	}

	export type DropdownMenuEntry = DropdownMenuItem | { separator: true }

	interface Props {
		children: Snippet
		items: DropdownMenuEntry[]
		open?: boolean
		align?: 'start' | 'center' | 'end'
		side?: 'top' | 'bottom' | 'left' | 'right'
		sideOffset?: number
		class?: string
	}

	let {
		children,
		items,
		open = $bindable(false),
		align = 'end',
		side = 'bottom',
		sideOffset = 4,
		class: className = '',
	}: Props = $props()

	type Variant = 'default' | 'destructive'

	const itemVariantClasses: Record<Variant, string> = {
		default: 'text-on-surface data-[highlighted]:bg-surface-container-high',
		destructive: 'text-error data-[highlighted]:bg-error/10',
	}

	const itemBaseClasses =
		'flex items-center gap-2 px-3 h-9 w-full rounded-md text-sm cursor-pointer outline-none select-none [&>svg]:size-4 [&>svg]:shrink-0 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed data-[disabled]:pointer-events-none'

	function itemClass(item: DropdownMenuItem) {
		return [itemBaseClasses, itemVariantClasses[item.variant ?? 'default']].join(' ')
	}
</script>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger>
		{@render children()}
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			{side}
			{align}
			{sideOffset}
			class={[
				'z-50 min-w-48 rounded-lg border border-outline bg-surface p-1 shadow-md outline-none',
				className,
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
