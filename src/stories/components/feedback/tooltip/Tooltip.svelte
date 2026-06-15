<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';

	interface Props {
		text?: string;
		side?: 'top' | 'bottom' | 'left' | 'right';
		delayDuration?: number;
		triggerClass?: string;
		children: Snippet;
		content?: Snippet;
	}

	const { text, side = 'bottom', delayDuration = 300, triggerClass = '', children, content }: Props = $props();
</script>

<TooltipPrimitive.Provider {delayDuration}>
	<TooltipPrimitive.Root>
		<TooltipPrimitive.Trigger class={triggerClass}>
			{@render children()}
		</TooltipPrimitive.Trigger>
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
