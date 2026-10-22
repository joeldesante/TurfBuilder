<script lang="ts">
	import * as d3 from 'd3';
	import ChartFrame from '../ChartFrame/ChartFrame.svelte';
	import ChartTooltip from '../ChartTooltip/ChartTooltip.svelte';
	import Legend from '../Legend/Legend.svelte';
	import { seriesColor } from '../chart-utils';
	import { categoriesToCsv, foldOther } from '$lib/shared/utils/chart-series';
	import { formatValue } from '$lib/shared/utils/chart-format';
	import type { CategoryDatum, ValueFormat } from '$lib/shared/types/charts';

	interface Props {
		title: string;
		subtitle?: string;
		data: CategoryDatum[];
		format?: ValueFormat;
		/** Hole size as a share of the radius: 0 draws a pie. */
		innerRadius?: number;
		/** Slices kept before the rest fold into "Other". At most 8. */
		maxSlices?: number;
		/** Text in the hole; defaults to the total. */
		centerLabel?: string;
		centerValue?: string;
		/** Plot height in px. */
		height?: number;
		loading?: boolean;
		error?: string | null;
		emptyText?: string;
		csvFilename?: string;
		/** Classes for the chart card, such as a grid span. */
		class?: string;
	}

	let {
		title,
		subtitle,
		data,
		format = 'number',
		innerRadius = 0.62,
		maxSlices = 6,
		centerLabel = 'Total',
		centerValue,
		height = 200,
		loading = false,
		error = null,
		emptyText,
		csvFilename,
		class: className = ''
	}: Props = $props();

	// Kept in the given order so a slice's color follows its category, not its rank.
	const slices = $derived(
		(data.length > maxSlices ? foldOther(data, Math.min(8, maxSlices)) : data)
			.filter((d) => d.value > 0)
			.map((d, i) => ({ ...d, color: d.color ?? seriesColor(i) }))
	);
	const total = $derived(slices.reduce((sum, d) => sum + d.value, 0));
	const empty = $derived(total === 0);

	let active = $state<number | null>(null);

	function share(value: number): string {
		return total ? formatValue(value / total, 'percent') : '0%';
	}
</script>

<ChartFrame
	class={className}
	{title}
	{subtitle}
	{height}
	{loading}
	{error}
	{empty}
	{emptyText}
	csv={() => categoriesToCsv(data)}
	{csvFilename}
>
	{#snippet children(width: number)}
		{@const size = Math.min(height, width < 360 ? width : width * 0.45)}
		{@const radius = size / 2}
		{@const arcs = d3
			.pie<(typeof slices)[number]>()
			.sort(null)
			.value((d) => d.value)
			.padAngle(slices.length > 1 ? 0.012 : 0)(slices)}
		{@const arc = d3
			.arc<d3.PieArcDatum<(typeof slices)[number]>>()
			.innerRadius(radius * innerRadius)
			.outerRadius(radius - 2)
			.cornerRadius(innerRadius > 0 ? 3 : 0)}
		{@const stackedLayout = width < 360}
		<div class="flex h-full items-center gap-6 {stackedLayout ? 'flex-col justify-center' : ''}">
			<svg
				width={size}
				height={size}
				role="img"
				aria-label={`${title}. ${slices.map((d) => `${d.label} ${formatValue(d.value, format)}, ${share(d.value)}`).join('. ')}.`}
				class="shrink-0 overflow-visible"
			>
				<g transform={`translate(${radius},${radius})`}>
					{#each arcs as a, i (a.data.key)}
						<path
							d={arc(a) ?? ''}
							fill={a.data.color}
							stroke="var(--surface)"
							stroke-width="2"
							opacity={active === null || active === i ? 1 : 0.55}
							role="presentation"
							onpointerenter={() => (active = i)}
							onpointerleave={() => (active = null)}
						/>
					{/each}
					{#if innerRadius > 0.3}
						<text text-anchor="middle" dy="-0.2em" font-size="20" font-weight="600" fill="var(--on-surface)">
							{centerValue ?? formatValue(total, format === 'number' ? 'compact' : format)}
						</text>
						<text text-anchor="middle" dy="1.3em" font-size="11" fill="var(--on-surface-subtle)">{centerLabel}</text>
					{/if}
				</g>
			</svg>
			{#if !stackedLayout}
				<div class="min-w-0 flex-1">
					<Legend vertical items={slices.map((d) => ({ key: d.key, label: d.label, color: d.color, value: `${formatValue(d.value, format)} · ${share(d.value)}` }))} />
				</div>
			{:else}
				<Legend items={slices.map((d) => ({ key: d.key, label: d.label, color: d.color, value: share(d.value) }))} />
			{/if}
		</div>
		{#if active !== null}
			{@const d = slices[active]}
			<ChartTooltip
				heading={d.label}
				x={size / 2}
				y={8}
				containerWidth={width}
				rows={[{ color: d.color, label: formatValue(d.value, format), value: share(d.value) }]}
			/>
		{/if}
	{/snippet}

	{#snippet table()}
		<table>
			<caption>{title}</caption>
			<tbody>
				{#each slices as d (d.key)}
					<tr><th scope="row">{d.label}</th><td>{formatValue(d.value, format)}</td><td>{share(d.value)}</td></tr>
				{/each}
			</tbody>
		</table>
	{/snippet}
</ChartFrame>
