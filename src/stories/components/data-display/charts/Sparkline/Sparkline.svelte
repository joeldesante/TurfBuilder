<script lang="ts">
	import * as d3 from 'd3';
	import type { TimePoint } from '$lib/shared/types/charts';

	interface Props {
		points: TimePoint[];
		/** Names the trend for screen readers, such as "Sign-ups, last 30 days". */
		label: string;
		height?: number;
		color?: string;
		/** Fill under the line. */
		area?: boolean;
	}

	let { points, label, height = 32, color = 'var(--chart-1)', area = true }: Props = $props();

	let width = $state(0);

	const values = $derived(points.map((p) => p.value));
	const description = $derived(
		values.length
			? `${label}: from ${values[0].toLocaleString()} to ${values.at(-1)!.toLocaleString()}, peaking at ${Math.max(...values).toLocaleString()}.`
			: `${label}: no data.`
	);
</script>

<div class="w-full" style:height="{height}px" bind:clientWidth={width}>
	{#if width > 0 && points.length > 1}
		{@const x = d3.scaleLinear().domain([0, points.length - 1]).range([1, width - 3])}
		{@const max = d3.max(values) ?? 0}
		{@const y = d3.scaleLinear().domain([0, max > 0 ? max : 1]).range([height - 2, 3])}
		{@const line = d3.line<TimePoint>().x((_, i) => x(i)).y((d) => y(d.value)).curve(d3.curveMonotoneX)}
		{@const fill = d3.area<TimePoint>().x((_, i) => x(i)).y0(height).y1((d) => y(d.value)).curve(d3.curveMonotoneX)}
		<svg {width} {height} role="img" aria-label={description}>
			{#if area}<path d={fill(points) ?? ''} fill={color} fill-opacity="0.12" />{/if}
			<path d={line(points) ?? ''} fill="none" stroke={color} stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
			<circle cx={x(points.length - 1)} cy={y(values.at(-1)!)} r="2.5" fill={color} />
		</svg>
	{:else}
		<span class="sr-only">{description}</span>
	{/if}
</div>
