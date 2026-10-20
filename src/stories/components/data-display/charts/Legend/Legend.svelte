<script lang="ts">
	export interface LegendItem {
		key: string;
		label: string;
		color: string;
		dashed?: boolean;
		/** Shown after the label, such as a total or share. */
		value?: string;
	}

	interface Props {
		items: LegendItem[];
		/** Keys of series hidden from the chart. */
		hidden?: string[];
		/** Makes each item a toggle that hides or shows its series. */
		ontoggle?: (key: string) => void;
		/** Stack the items, one per line, as beside a donut. */
		vertical?: boolean;
	}

	let { items, hidden = [], ontoggle, vertical = false }: Props = $props();
</script>

<ul class="flex gap-x-4 gap-y-1 text-xs text-on-surface-subtle {vertical ? 'flex-col' : 'flex-wrap'}">
	{#each items as item (item.key)}
		{@const off = hidden.includes(item.key)}
		<li>
			{#snippet content()}
				<span
					class="inline-block h-0.5 w-3 shrink-0 rounded-full"
					style:background={item.dashed ? 'none' : item.color}
					style:border-top={item.dashed ? `2px dashed ${item.color}` : undefined}
					style:height={item.dashed ? '0' : undefined}
					aria-hidden="true"
				></span>
				<span class="truncate {off ? 'line-through' : 'text-on-surface'}">{item.label}</span>
				{#if item.value}<span class="ml-auto pl-2 tabular-nums">{item.value}</span>{/if}
			{/snippet}
			{#if ontoggle}
				<button
					type="button"
					aria-pressed={!off}
					class="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-surface-container {off ? 'opacity-60' : ''}"
					onclick={() => ontoggle(item.key)}
				>
					{@render content()}
					<span class="sr-only">{off ? '(hidden)' : '(shown)'}</span>
				</button>
			{:else}
				<span class="flex items-center gap-1.5 px-1 py-0.5">{@render content()}</span>
			{/if}
		</li>
	{/each}
</ul>
