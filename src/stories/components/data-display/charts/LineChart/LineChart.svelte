<script lang="ts">
	import * as d3 from 'd3';
	import ChartFrame from '../ChartFrame/ChartFrame.svelte';
	import ChartTooltip from '../ChartTooltip/ChartTooltip.svelte';
	import Legend from '../Legend/Legend.svelte';
	import { bucketDate, seriesColor, spreadLabels } from '../chart-utils';
	import { seriesToCsv } from '$lib/shared/utils/chart-series';
	import { formatBucket, formatValue } from '$lib/shared/utils/chart-format';
	import type { Granularity, TimeSeries, ValueFormat } from '$lib/shared/types/charts';

	interface Props {
		title: string;
		subtitle?: string;
		series: TimeSeries[];
		granularity?: Granularity;
		format?: ValueFormat;
		/** Plot height in px. */
		height?: number;
		/** Fills under each line. With one series this is a soft area; with several, use `stacked`. */
		area?: boolean;
		/** Stacks the series as areas, for parts of a whole over time. */
		stacked?: boolean;
		/** Curved lines instead of straight segments. */
		smooth?: boolean;
		loading?: boolean;
		error?: string | null;
		emptyText?: string;
		/** Adds a CSV download named this. */
		csvFilename?: string;
		/** Classes for the chart card, such as a grid span. */
		class?: string;
	}

	let {
		title,
		subtitle,
		series,
		granularity = 'day',
		format = 'number',
		height = 240,
		area = false,
		stacked = false,
		smooth = false,
		loading = false,
		error = null,
		emptyText,
		csvFilename,
		class: className = ''
	}: Props = $props();

	let hidden = $state<string[]>([]);
	let active = $state<number | null>(null);

	const colored = $derived(series.map((s, i) => ({ ...s, color: seriesColor(i, s.color) })));
	const visible = $derived(colored.filter((s) => !hidden.includes(s.key)));
	const dates = $derived([...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort());
	const empty = $derived(dates.length === 0 || series.every((s) => s.points.every((p) => p.value === 0)));

	// Direct labels at line ends for up to four lines; a legend for two or more.
	const directLabels = $derived(!stacked && visible.length > 1 && visible.length <= 4);
	const margin = $derived({ top: 8, right: directLabels ? 96 : 12, bottom: 24, left: 44 });

	function valueAt(s: TimeSeries, date: string): number {
		return s.points.find((p) => p.date === date)?.value ?? 0;
	}

	function toggle(key: string) {
		hidden = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
	}

	function summary(): string {
		if (empty) return `${title}: no data.`;
		const parts = visible.map((s) => {
			const values = s.points.map((p) => p.value);
			const last = values.at(-1) ?? 0;
			return `${s.label} ends at ${formatValue(last, format)}, peaking at ${formatValue(Math.max(...values), format)}`;
		});
		return `${title}, ${formatBucket(dates[0], granularity, true)} to ${formatBucket(dates.at(-1)!, granularity, true)}. ${parts.join('. ')}.`;
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
	csv={() => seriesToCsv(series)}
	{csvFilename}
>
	{#snippet legend()}
		{#if colored.length > 1}
			<Legend
				items={colored.map((s) => ({ key: s.key, label: s.label, color: s.color, dashed: s.dashed }))}
				{hidden}
				ontoggle={toggle}
			/>
		{/if}
	{/snippet}

	{#snippet children(width: number)}
		{@const innerW = Math.max(10, width - margin.left - margin.right)}
		{@const innerH = Math.max(10, height - margin.top - margin.bottom)}
		{@const x = d3
			.scaleUtc()
			.domain([bucketDate(dates[0]), bucketDate(dates.at(-1)!)])
			.range(dates.length === 1 ? [innerW / 2, innerW / 2] : [0, innerW])}
		{@const stackData = stacked
			? d3
					.stack<string>()
					.keys(visible.map((s) => s.key))
					.value((date, key) => valueAt(visible.find((s) => s.key === key)!, date))(dates)
			: null}
		{@const maxY = stackData
			? (d3.max(stackData.at(-1) ?? [], (d) => d[1]) ?? 0)
			: (d3.max(visible.flatMap((s) => s.points.map((p) => p.value))) ?? 0)}
		{@const y = d3
			.scaleLinear()
			.domain([0, maxY > 0 ? maxY : 1])
			.nice(4)
			.range([innerH, 0])}
		{@const curve = smooth ? d3.curveMonotoneX : d3.curveLinear}
		{@const xTicks = x.ticks(Math.max(2, Math.floor(innerW / 90)))}
		{@const yTicks = y.ticks(4)}
		{@const line = d3
			.line<{ date: string; value: number }>()
			.x((d) => x(bucketDate(d.date)))
			.y((d) => y(d.value))
			.curve(curve)}
		{@const fill = d3
			.area<{ date: string; value: number }>()
			.x((d) => x(bucketDate(d.date)))
			.y0(innerH)
			.y1((d) => y(d.value))
			.curve(curve)}
		{@const ends = directLabels
			? spreadLabels(
					visible.map((s) => ({
						key: s.key,
						label: s.label,
						color: s.color,
						y: y(valueAt(s, dates.at(-1)!))
					})),
					13,
					innerH
				)
			: []}
		{@const activeDate = active !== null ? dates[active] : null}
		{@const activeX = activeDate ? x(bucketDate(activeDate)) : 0}

		<!-- Focusable so keyboard users can step the crosshair with the arrow keys; the
		     summary label and the hidden table carry the same values for screen readers. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<svg
			{width}
			{height}
			role="img"
			aria-label={summary()}
			tabindex="0"
			class="overflow-visible outline-none focus-visible:outline-2 focus-visible:outline-primary"
			onkeydown={(event) => {
				if (event.key === 'ArrowRight') active = Math.min(dates.length - 1, (active ?? -1) + 1);
				else if (event.key === 'ArrowLeft') active = Math.max(0, (active ?? dates.length) - 1);
				else if (event.key === 'Escape') active = null;
				else return;
				event.preventDefault();
			}}
			onblur={() => (active = null)}
		>
			<g transform={`translate(${margin.left},${margin.top})`}>
				{#each yTicks as tick (tick)}
					<g transform={`translate(0,${y(tick)})`}>
						<line x2={innerW} stroke="var(--chart-grid)" stroke-width="1" />
						<text x="-8" dy="0.32em" text-anchor="end" font-size="11" fill="var(--chart-ink-muted)" class="tabular-nums">
							{formatValue(tick, format === 'number' ? 'compact' : format)}
						</text>
					</g>
				{/each}
				<line y1={innerH} y2={innerH} x2={innerW} stroke="var(--chart-axis)" stroke-width="1" />
				{#each xTicks as tick (tick.getTime())}
					<text
						x={x(tick)}
						y={innerH + 16}
						text-anchor="middle"
						font-size="11"
						fill="var(--chart-ink-muted)"
					>
						{formatBucket(tick.toISOString(), granularity === 'month' ? 'month' : 'day')}
					</text>
				{/each}

				{#if stackData}
					{#each stackData as layer, i (layer.key)}
						{@const s = visible[i]}
						<path
							d={d3
								.area<d3.SeriesPoint<string>>()
								.x((d) => x(bucketDate(d.data)))
								.y0((d) => y(d[0]))
								.y1((d) => y(d[1]))
								.curve(curve)(layer) ?? ''}
							fill={s.color}
							fill-opacity="0.85"
							stroke="var(--surface)"
							stroke-width="1"
						/>
					{/each}
				{:else}
					{#each visible as s (s.key)}
						{#if area}
							<path d={fill(s.points) ?? ''} fill={s.color} fill-opacity={visible.length === 1 ? 0.12 : 0.06} />
						{/if}
						<path
							d={line(s.points) ?? ''}
							fill="none"
							stroke={s.color}
							stroke-width="2"
							stroke-linejoin="round"
							stroke-linecap="round"
							stroke-dasharray={s.dashed ? '4 4' : undefined}
						/>
						{#if s.points.length === 1}
							<circle cx={x(bucketDate(s.points[0].date))} cy={y(s.points[0].value)} r="4" fill={s.color} />
						{/if}
					{/each}
				{/if}

				{#each ends as label (label.key)}
					<text x={innerW + 8} y={label.labelY} dy="0.32em" font-size="11" fill="var(--on-surface-subtle)">
						{label.label.length > 14 ? `${label.label.slice(0, 13)}…` : label.label}
					</text>
				{/each}

				{#if activeDate}
					<line x1={activeX} x2={activeX} y2={innerH} stroke="var(--chart-axis)" stroke-width="1" />
					{#each visible as s, i (s.key)}
						{@const v = stackData ? stackData[i].find((d) => d.data === activeDate)?.[1] ?? 0 : valueAt(s, activeDate)}
						<circle cx={activeX} cy={y(v)} r="4" fill={s.color} stroke="var(--surface)" stroke-width="2" />
					{/each}
				{/if}

				<!-- Hover target over the whole plot; the nearest bucket wins. -->
				<rect
					width={innerW}
					height={innerH}
					fill="transparent"
					role="presentation"
					onpointermove={(event) => {
						const px = event.clientX - event.currentTarget.getBoundingClientRect().left;
						const t = x.invert(px).getTime();
						let best = 0;
						for (let i = 1; i < dates.length; i++) {
							if (Math.abs(bucketDate(dates[i]).getTime() - t) < Math.abs(bucketDate(dates[best]).getTime() - t)) best = i;
						}
						active = best;
					}}
					onpointerleave={() => (active = null)}
				/>
			</g>
		</svg>

		{#if activeDate}
			<ChartTooltip
				heading={formatBucket(activeDate, granularity, true)}
				x={margin.left + activeX}
				y={margin.top}
				containerWidth={width}
				rows={visible.map((s) => ({ color: s.color, label: s.label, value: formatValue(valueAt(s, activeDate), format) }))}
			/>
			<p class="sr-only" aria-live="polite">
				{formatBucket(activeDate, granularity, true)}: {visible
					.map((s) => `${s.label} ${formatValue(valueAt(s, activeDate), format)}`)
					.join(', ')}
			</p>
		{/if}
	{/snippet}

	{#snippet table()}
		<table>
			<caption>{title}</caption>
			<thead>
				<tr>
					<th scope="col">Date</th>
					{#each series as s (s.key)}<th scope="col">{s.label}</th>{/each}
				</tr>
			</thead>
			<tbody>
				{#each dates as date (date)}
					<tr>
						<th scope="row">{formatBucket(date, granularity, true)}</th>
						{#each series as s (s.key)}<td>{formatValue(valueAt(s, date), format)}</td>{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	{/snippet}
</ChartFrame>
