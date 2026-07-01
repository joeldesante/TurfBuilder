<script lang="ts">
	import * as d3 from 'd3';
	import ChartTooltip from '$components/data-display/charts/ChartTooltip/ChartTooltip.svelte';

	export type Granularity = 'day' | 'week' | 'month';

	export interface DataPoint {
		date: Date;
		qty: number;
	}

	export interface Series {
		name: string;
		color: string;
		showArea?: boolean;
		data: DataPoint[];
	}

	interface Props {
		title?: string;
		subtitle?: string;
		series: Series[];
		granularity?: Granularity;
	}

	let { title: _title, subtitle: _subtitle, series = [], granularity }: Props = $props();

	const margin = { top: 20, right: 20, bottom: 40, left: 50 };
	const totalWidth = 700;
	const totalHeight = 300;
	const width = totalWidth - margin.left - margin.right;
	const height = totalHeight - margin.top - margin.bottom;

	let allPoints = $derived(series.flatMap((s) => s.data));

	let x = $derived(
		d3
			.scaleUtc()
			.domain([
				d3.min(allPoints, (d) => d.date) ?? new Date(),
				d3.utcDay.floor(d3.max([d3.max(allPoints, (d) => d.date) ?? new Date(), new Date()])!)
			])
			.range([0, width])
	);

	let y = $derived(
		d3
			.scaleLinear()
			.domain([0, ((d3.max(allPoints, (d) => d.qty) as number) ?? 0) * 1.1])
			.range([height, 0])
			.nice()
	);

	let spanDays = $derived(
		allPoints.length > 1
			? (d3.max(allPoints, (d) => d.date)!.getTime() -
					d3.min(allPoints, (d) => d.date)!.getTime()) /
					86_400_000
			: 0
	);

	let resolvedGranularity = $derived<Granularity>(
		granularity ?? (spanDays > 60 ? 'month' : spanDays > 7 ? 'week' : 'day')
	);

	function tickInterval(g: Granularity): d3.TimeInterval {
		switch (g) {
			case 'day':
				return d3.utcDay.every(1)!;
			case 'week':
				return d3.utcWeek.every(1)!;
			case 'month':
				return d3.utcMonth.every(1)!;
		}
	}

	function formatTick(date: Date, g: Granularity): string {
		switch (g) {
			case 'day':
				return new Intl.DateTimeFormat('en-US', {
					month: '2-digit',
					day: '2-digit',
					timeZone: 'UTC'
				}).format(date);
			case 'week':
				return new Intl.DateTimeFormat('en-US', {
					month: 'short',
					day: 'numeric',
					timeZone: 'UTC'
				}).format(date);
			case 'month':
				return new Intl.DateTimeFormat('en-US', {
					month: 'short',
					year: 'numeric',
					timeZone: 'UTC'
				}).format(date);
		}
	}

	let xTicks = $derived(x.ticks(tickInterval(resolvedGranularity)));
	let yTicks = $derived(y.ticks(5));
	let tickWidth = $derived(xTicks.length > 1 ? x(xTicks[1]) - x(xTicks[0]) : width);

	let hoveredTick = $state<Date | null>(null);

	// For each series, find the data point whose date is nearest to the given tick.
	function nearestQty(data: DataPoint[], tick: Date): number | null {
		if (data.length === 0) return null;
		const t = tick.getTime();
		return data.reduce((best, d) =>
			Math.abs(d.date.getTime() - t) < Math.abs(best.date.getTime() - t) ? d : best
		).qty;
	}

	// Tooltip x in figure-relative pixels (accounts for SVG margin).
	let tooltipX = $derived(hoveredTick !== null ? margin.left + x(hoveredTick) : 0);
	// Flip to the left when we're past the midpoint so it doesn't overflow.
	let tooltipFlip = $derived(tooltipX > totalWidth / 2);

	function buildLinePath(data: DataPoint[]): string | null {
		return d3
			.line<DataPoint>()
			.x((d) => x(d.date))
			.y((d) => y(d.qty))
			.curve(d3.curveLinear)(data);
	}

	function buildAreaPath(data: DataPoint[]): string | null {
		return d3
			.area<DataPoint>()
			.x((d) => x(d.date))
			.y0(height)
			.y1((d) => y(d.qty))
			.curve(d3.curveLinear)(data);
	}
</script>

<figure>
	<svg width={totalWidth} height={totalHeight}>
		<g transform={`translate(${margin.left}, ${margin.top})`}>
			<defs>
				<clipPath id="chart-area">
					<rect x={0} y={0} {width} {height} />
				</clipPath>
			</defs>

			<g>
				<!-- Y Axis -->
				{#each yTicks as tick}
					<g transform={`translate(0, ${y(tick)})`}>
						<line x2={width} stroke="var(--outline-subtle)" stroke-linecap="butt" />
						<text x="-10" dy="0.35em" text-anchor="end" font-size="11" fill="#999">{tick}</text>
					</g>
				{/each}
			</g>

			<g clip-path="url(#chart-area)">
				<!-- Areas rendered first so lines appear on top -->
				{#each series as s}
					{#if s.showArea}
						<path d={buildAreaPath(s.data)} fill={s.color} opacity="0.15" stroke="none" />
					{/if}
				{/each}
				{#each series as s}
					<path
						d={buildLinePath(s.data)}
						fill="none"
						stroke={s.color}
						stroke-width="4"
						stroke-linecap="butt"
					/>
				{/each}
			</g>

			<g>
				<!-- X Axis -->
				{#each xTicks as tick}
					<g
						role="presentation"
						transform={`translate(${x(tick)}, ${height})`}
						onmouseenter={() => (hoveredTick = tick)}
						onmouseleave={() => (hoveredTick = null)}
					>
						<rect
							x={tickWidth / -2}
							y={-height}
							width={tickWidth}
							height={height + 20}
							fill="transparent"
						/>
						<line y2={-5} stroke="var(--outline-subtle)" stroke-linecap="round" />
						<text x="0" y="15" dy="0.35em" font-size="11" fill="#999" text-anchor="middle">
							{formatTick(tick, resolvedGranularity)}
						</text>
					</g>
				{/each}
			</g>

			{#if hoveredTick !== null}
				<line
					x1={x(hoveredTick)}
					x2={x(hoveredTick)}
					y1={0}
					y2={height}
					stroke="var(--secondary)"
					stroke-width="1"
					stroke-dasharray="1 4"
				/>
			{/if}
		</g>
	</svg>

	{#if hoveredTick !== null}
		<ChartTooltip
			heading={formatTick(hoveredTick, resolvedGranularity)}
			x={tooltipX}
			y={margin.top}
			flip={tooltipFlip}
			rows={series
				.map((s) => ({ color: s.color, label: s.name, qty: nearestQty(s.data, hoveredTick!) }))
				.filter((r) => r.qty !== null)
				.map((r) => ({ color: r.color, label: r.label, value: r.qty!.toLocaleString() }))}
		/>
	{/if}
</figure>

<style>
	figure {
		position: relative;
		cursor: crosshair;
	}
</style>
