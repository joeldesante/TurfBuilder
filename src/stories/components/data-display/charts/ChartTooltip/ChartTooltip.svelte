<script lang="ts">
	interface Row {
		color: string;
		label: string;
		value: string;
	}

	interface Props {
		heading: string;
		rows: Row[];
		/** Left offset in px within the chart's plot area. */
		x: number;
		/** Top offset in px within the chart's plot area. */
		y: number;
		/** Width of the plot area; the tooltip flips to the left of x past its middle so it never overflows. */
		containerWidth?: number;
		/** Forces the side; overrides containerWidth. */
		flip?: boolean;
	}

	let { heading, rows, x, y, containerWidth, flip }: Props = $props();

	const toLeft = $derived(flip ?? (containerWidth !== undefined && x > containerWidth / 2));
</script>

<!-- Hidden from screen readers: the chart's table and live summary carry the same values. -->
<div
	aria-hidden="true"
	class="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-outline-subtle bg-surface-container-high px-2.5 py-2 text-xs shadow-lg"
	style:left="{x}px"
	style:top="{y}px"
	style:transform={toLeft ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)'}
>
	<p class="mb-1 text-on-surface-subtle">{heading}</p>
	{#each rows as row, i (i)}
		<div class="mt-1 flex items-center gap-2">
			<span class="size-2 shrink-0 rounded-full" style:background={row.color}></span>
			<span class="flex-1 truncate text-on-surface">{row.label}</span>
			<span class="font-medium tabular-nums text-on-surface">{row.value}</span>
		</div>
	{/each}
</div>
