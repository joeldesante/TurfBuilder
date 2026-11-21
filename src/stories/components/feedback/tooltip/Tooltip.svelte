<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';

	interface Props {
		text?: string;
		side?: 'top' | 'bottom' | 'left' | 'right';
		delayDuration?: number;
		triggerClass?: string;
		/** What the tooltip is on. Wrapped in a button that opens the tooltip. */
		children?: Snippet;
		/**
		 * Instead of `children`: renders the element the tooltip is on itself, given the props to
		 * spread onto it. Use it when that element is a button, which cannot sit inside the button
		 * `children` is wrapped in.
		 */
		trigger?: Snippet<[Record<string, unknown>]>;
		content?: Snippet;
	}

	const {
		text,
		side = 'bottom',
		delayDuration = 300,
		triggerClass = '',
		children,
		trigger,
		content
	}: Props = $props();
</script>

<TooltipPrimitive.Provider {delayDuration}>
	<TooltipPrimitive.Root>
		{#if trigger}
			<TooltipPrimitive.Trigger>
				{#snippet child({ props })}
					{@render trigger(props)}
				{/snippet}
			</TooltipPrimitive.Trigger>
		{:else}
			<TooltipPrimitive.Trigger class={triggerClass}>
				{@render children?.()}
			</TooltipPrimitive.Trigger>
		{/if}
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				{side}
				sideOffset={6}
				class="z-50 max-w-xs rounded-lg bg-inverse-surface px-3 py-2 text-xs text-inverse-on-surface shadow-md"
			>
				{#if content}
					{@render content()}
				{:else}
					{text}
				{/if}
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	</TooltipPrimitive.Root>
</TooltipPrimitive.Provider>
