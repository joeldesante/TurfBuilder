<script lang="ts">
	import '$lib/charts.css';
	import * as d3 from 'd3';

	interface Slice {
		label: string;
		value: number;
		color?: string;
	}

	interface Props {
		title?: string;
		subtitle?: string;
		data: Slice[];
		/** Outer radius in pixels. @default 120 */
		radius?: number;
		/** Inner radius for donut. 0 = full pie. @default 0 */
		innerRadius?: number;
		/** Show value tooltips on hover. @default true */
		tooltip?: boolean;
		/** Show legend. @default false */
		legend?: boolean;
		/** Color scheme. @default d3.schemeTableau10 */
		colors?: readonly string[];
	}

	let {
		title,
		subtitle,
		data,
		radius = 120,
		innerRadius = 0,
		tooltip = true,
		legend = false,
		colors = d3.schemeTableau10
	}: Props = $props();

	let svgEl: SVGSVGElement;
	let hoveredSlice = $state<Slice | null>(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	const size = $derived(radius * 2 + 40);
	const colorScale = $derived(d3.scaleOrdinal(colors).domain(data.map((d) => d.label)));

	const arcs = $derived(() => {
		const pie = d3.pie<Slice>().value((d) => d.value).sort(null);
		const arc = d3.arc<d3.PieArcDatum<Slice>>().innerRadius(innerRadius).outerRadius(radius);
		return pie(data).map((d) => ({ ...d, path: arc(d) ?? '' }));
	});

	function onMouseMove(event: MouseEvent, slice: Slice) {
		const rect = svgEl.getBoundingClientRect();
		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top;
		hoveredSlice = slice;
	}
</script>

<figure>
	{#if title}
		<figcaption class="text-lg font-semibold text-on-surface">{title}</figcaption>
	{/if}
	{#if subtitle}
		<p class="text-xs text-on-surface-subtle">{subtitle}</p>
	{/if}
<div class="relative inline-block">
	<svg bind:this={svgEl} width={size} height={size} aria-label="Pie chart">
		<g transform="translate({size / 2},{size / 2})">
			{#each arcs() as arc}
				<path
					d={arc.path}
					fill={arc.data.color ?? colorScale(arc.data.label)}
					stroke="var(--surface)"
					stroke-width="2"
					class="cursor-pointer transition-opacity"
					opacity={hoveredSlice && hoveredSlice !== arc.data ? 0.6 : 1}
					onmousemove={(e) => onMouseMove(e, arc.data)}
					onmouseleave={() => (hoveredSlice = null)}
					role="img"
					aria-label="{arc.data.label}: {arc.data.value}"
				/>
			{/each}
		</g>
	</svg>

	{#if tooltip && hoveredSlice}
		<div
			class="pointer-events-none absolute z-50 rounded-lg bg-inverse-surface px-3 py-2 text-xs text-inverse-on-surface shadow-md"
			style="left: {tooltipX + 12}px; top: {tooltipY - 8}px"
		>
			<span class="font-medium">{hoveredSlice.label}</span>
			<span class="ml-2">{hoveredSlice.value}</span>
		</div>
	{/if}

	{#if legend}
		<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
			{#each data as slice}
				<div class="flex items-center gap-1.5 text-xs text-on-surface">
					<span
						class="inline-block size-2.5 rounded-full"
						style="background: {slice.color ?? colorScale(slice.label)}"
					></span>
					{slice.label}
				</div>
			{/each}
		</div>
	{/if}
</div>
</figure>
