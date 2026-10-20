<script lang="ts">
	import * as d3 from 'd3';
	import ChartFrame from '../ChartFrame/ChartFrame.svelte';
	import ChartTooltip from '../ChartTooltip/ChartTooltip.svelte';
	import Legend from '../Legend/Legend.svelte';
	import { seriesColor } from '../chart-utils';
	import { categoriesToCsv, seriesToCsv } from '$lib/shared/utils/chart-series';
	import { formatBucket, formatValue } from '$lib/shared/utils/chart-format';
	import type { CategoryDatum, Granularity, TimeSeries, ValueFormat } from '$lib/shared/types/charts';

	interface Props {
		title: string;
		subtitle?: string;
		/** Categories, one bar each: a ranking such as top organizations. */
		data?: CategoryDatum[];
		/** Time buckets instead of categories, one bar (or stack) per bucket. */
		series?: TimeSeries[];
		granularity?: Granularity;
		/** For categories: horizontal reads best for long labels. Time series are always vertical. */
		orientation?: 'horizontal' | 'vertical';
		/** For several series: stack them (parts of a whole) or set them side by side. */
		stacked?: boolean;
		format?: ValueFormat;
		/** Print each bar's value at its end. Defaults on for horizontal bars. */
		valueLabels?: boolean;
		/** Plot height in px; horizontal bars size themselves to their rows when omitted. */
		height?: number;
		/** Href for each category's label, such as its detail page. */
		href?: (datum: CategoryDatum) => string | undefined;
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
		series,
		granularity = 'day',
		orientation = 'horizontal',
		stacked = true,
		format = 'number',
		valueLabels,
		height,
		href,
		loading = false,
		error = null,
		emptyText,
		csvFilename,
		class: className = ''
	}: Props = $props();

	const timeMode = $derived(Boolean(series));
	const horizontal = $derived(!timeMode && orientation === 'horizontal');
	const showValues = $derived(valueLabels ?? horizontal);
	const ROW = 30;

	const categories = $derived(data ?? []);
	const colored = $derived((series ?? []).map((s, i) => ({ ...s, color: seriesColor(i, s.color) })));
	let hidden = $state<string[]>([]);
	const visible = $derived(colored.filter((s) => !hidden.includes(s.key)));
	const dates = $derived([...new Set((series ?? []).flatMap((s) => s.points.map((p) => p.date)))].sort());

	const empty = $derived(
		timeMode ? dates.length === 0 || colored.every((s) => s.points.every((p) => p.value === 0)) : categories.length === 0
	);
	const plotHeight = $derived(height ?? (horizontal ? Math.max(ROW * 2, categories.length * ROW + 8) : 240));

	let active = $state<number | null>(null);

	function valueAt(s: TimeSeries, date: string): number {
		return s.points.find((p) => p.date === date)?.value ?? 0;
	}

	/** A bar with only its data end rounded: the end away from the baseline. */
	function barPath(x0: number, y0: number, w: number, h: number, end: 'right' | 'top', radius = 4): string {
		if (w <= 0 || h <= 0) return '';
		const r = Math.min(radius, end === 'right' ? w : h, end === 'right' ? h / 2 : w / 2);
		if (end === 'right') {
			return `M${x0},${y0}H${x0 + w - r}A${r},${r} 0 0 1 ${x0 + w},${y0 + r}V${y0 + h - r}A${r},${r} 0 0 1 ${x0 + w - r},${y0 + h}H${x0}Z`;
		}
		return `M${x0},${y0 + h}V${y0 + r}A${r},${r} 0 0 1 ${x0 + r},${y0}H${x0 + w - r}A${r},${r} 0 0 1 ${x0 + w},${y0 + r}V${y0 + h}Z`;
	}

	function summary(): string {
		if (empty) return `${title}: no data.`;
		if (!timeMode) {
			const top = [...categories].sort((a, b) => b.value - a.value).slice(0, 3);
			return `${title}. ${top.map((d) => `${d.label} ${formatValue(d.value, format)}`).join(', ')}.`;
		}
		return `${title}, ${dates.length} periods. ${visible
			.map((s) => `${s.label} totals ${formatValue(s.points.reduce((sum, p) => sum + p.value, 0), format)}`)
			.join('. ')}.`;
	}

	function toggle(key: string) {
		hidden = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
	}
</script>

<ChartFrame
	class={className}
	{title}
	{subtitle}
	height={plotHeight}
	{loading}
	{error}
	{empty}
	{emptyText}
	csv={() => (timeMode ? seriesToCsv(series ?? []) : categoriesToCsv(categories))}
	{csvFilename}
>
	{#snippet legend()}
		{#if colored.length > 1}
			<Legend items={colored.map((s) => ({ key: s.key, label: s.label, color: s.color }))} {hidden} ontoggle={toggle} />
		{/if}
	{/snippet}

	{#snippet children(width: number)}
		{#if horizontal}
			{@const labelW = Math.min(180, Math.max(80, width * 0.32))}
			{@const valueW = showValues ? 56 : 8}
			{@const innerW = Math.max(10, width - labelW - valueW)}
			{@const max = d3.max(categories, (d) => d.value) ?? 0}
			{@const x = d3.scaleLinear().domain([0, max > 0 ? max : 1]).range([0, innerW])}
			{@const barH = ROW - 10}
			<svg {width} height={plotHeight} role="img" aria-label={summary()} class="overflow-visible">
				{#each categories as d, i (d.key)}
					{@const y0 = i * ROW + 4}
					{@const link = href?.(d)}
					<g
						role="presentation"
						onpointerenter={() => (active = i)}
						onpointerleave={() => (active = null)}
						opacity={active === null || active === i ? 1 : 0.6}
					>
						<rect x="0" y={y0 - 4} {width} height={ROW} fill="transparent" />
						{#if link}
							<a href={link}>
								<text x={labelW - 8} y={y0 + barH / 2} dy="0.32em" text-anchor="end" font-size="12" fill="var(--on-surface)" class="underline-offset-2 hover:underline">
									{d.label.length > 24 ? `${d.label.slice(0, 23).trimEnd()}…` : d.label}
								</text>
							</a>
						{:else}
							<text x={labelW - 8} y={y0 + barH / 2} dy="0.32em" text-anchor="end" font-size="12" fill="var(--on-surface)">
								{d.label.length > 24 ? `${d.label.slice(0, 23).trimEnd()}…` : d.label}
							</text>
						{/if}
						<path d={barPath(labelW, y0, Math.max(x(d.value), d.value > 0 ? 2 : 0), barH, 'right')} fill={d.color ?? 'var(--chart-1)'} />
						{#if showValues}
							<text x={labelW + x(d.value) + 6} y={y0 + barH / 2} dy="0.32em" font-size="11" fill="var(--on-surface-subtle)" class="tabular-nums">
								{formatValue(d.value, format === 'number' ? 'compact' : format)}
							</text>
						{/if}
					</g>
				{/each}
			</svg>
		{:else}
			{@const margin = { top: 8, right: 8, bottom: 24, left: 44 }}
			{@const innerW = Math.max(10, width - margin.left - margin.right)}
			{@const innerH = Math.max(10, plotHeight - margin.top - margin.bottom)}
			{@const bands = timeMode ? dates : categories.map((d) => d.key)}
			{@const xb = d3.scaleBand<string>().domain(bands).range([0, innerW]).paddingInner(bands.length > 40 ? 0.15 : 0.3)}
			{@const totals = timeMode
				? dates.map((date) =>
						stacked ? visible.reduce((sum, s) => sum + valueAt(s, date), 0) : (d3.max(visible, (s) => valueAt(s, date)) ?? 0)
					)
				: categories.map((d) => d.value)}
			{@const max = d3.max(totals) ?? 0}
			{@const y = d3.scaleLinear().domain([0, max > 0 ? max : 1]).nice(4).range([innerH, 0])}
			{@const labelEvery = Math.max(1, Math.ceil(bands.length / Math.max(2, Math.floor(innerW / 70))))}
			<svg {width} height={plotHeight} role="img" aria-label={summary()} class="overflow-visible">
				<g transform={`translate(${margin.left},${margin.top})`}>
					{#each y.ticks(4) as tick (tick)}
						<g transform={`translate(0,${y(tick)})`}>
							<line x2={innerW} stroke="var(--chart-grid)" />
							<text x="-8" dy="0.32em" text-anchor="end" font-size="11" fill="var(--chart-ink-muted)" class="tabular-nums">
								{formatValue(tick, format === 'number' ? 'compact' : format)}
							</text>
						</g>
					{/each}
					{#each bands as band, i (band)}
						{@const bx = xb(band) ?? 0}
						{@const bw = xb.bandwidth()}
						<g role="presentation" onpointerenter={() => (active = i)} onpointerleave={() => (active = null)}>
							<rect x={bx - (xb.step() - bw) / 2} width={xb.step()} height={innerH} fill={active === i ? 'var(--chart-grid)' : 'transparent'} fill-opacity="0.5" />
							{#if timeMode && stacked}
								{@const top = visible.findLastIndex((s) => valueAt(s, band) > 0)}
								{#each visible as s, si (s.key)}
									{@const below = visible.slice(0, si).reduce((sum, o) => sum + valueAt(o, band), 0)}
									{@const v = valueAt(s, band)}
									{@const y0 = y(below + v)}
									{@const h = y(below) - y0}
									{#if v > 0}
										<path
											d={si === top ? barPath(bx, y0, bw, h, 'top') : `M${bx},${y0}h${bw}v${h}h${-bw}Z`}
											fill={s.color}
											stroke="var(--surface)"
											stroke-width="1"
										/>
									{/if}
								{/each}
							{:else if timeMode}
								{@const sub = d3.scaleBand<string>().domain(visible.map((s) => s.key)).range([0, bw]).paddingInner(0.15)}
								{#each visible as s (s.key)}
									{@const v = valueAt(s, band)}
									<path d={barPath(bx + (sub(s.key) ?? 0), y(v), sub.bandwidth(), innerH - y(v), 'top')} fill={s.color} />
								{/each}
							{:else}
								{@const d = categories[i]}
								<path d={barPath(bx, y(d.value), bw, innerH - y(d.value), 'top')} fill={d.color ?? 'var(--chart-1)'} />
								{#if showValues}
									<text x={bx + bw / 2} y={y(d.value) - 4} text-anchor="middle" font-size="11" fill="var(--on-surface-subtle)">
										{formatValue(d.value, format === 'number' ? 'compact' : format)}
									</text>
								{/if}
							{/if}
							{#if i % labelEvery === 0}
								<text x={bx + bw / 2} y={innerH + 16} text-anchor="middle" font-size="11" fill="var(--chart-ink-muted)">
									{timeMode ? formatBucket(band, granularity) : categories[i].label.slice(0, 12)}
								</text>
							{/if}
						</g>
					{/each}
					<line y1={innerH} y2={innerH} x2={innerW} stroke="var(--chart-axis)" />
				</g>
			</svg>
		{/if}

		{#if active !== null}
			{#if timeMode}
				{@const date = dates[active]}
				{@const band = d3.scaleBand<string>().domain(dates).range([0, Math.max(10, width - 52)]).paddingInner(0.3)}
				<ChartTooltip
					heading={formatBucket(date, granularity, true)}
					x={44 + (band(date) ?? 0) + band.bandwidth() / 2}
					y={8}
					containerWidth={width}
					rows={[
						...visible.map((s) => ({ color: s.color, label: s.label, value: formatValue(valueAt(s, date), format) })),
						...(stacked && visible.length > 1
							? [{ color: 'transparent', label: 'Total', value: formatValue(visible.reduce((sum, s) => sum + valueAt(s, date), 0), format) }]
							: [])
					]}
				/>
			{:else if !horizontal}
				{@const d = categories[active]}
				<ChartTooltip
					heading={d.label}
					x={width / 2}
					y={8}
					containerWidth={width}
					rows={[{ color: d.color ?? 'var(--chart-1)', label: title, value: formatValue(d.value, format) }]}
				/>
			{/if}
		{/if}
	{/snippet}

	{#snippet table()}
		<table>
			<caption>{title}</caption>
			{#if timeMode}
				<thead>
					<tr><th scope="col">Date</th>{#each colored as s (s.key)}<th scope="col">{s.label}</th>{/each}</tr>
				</thead>
				<tbody>
					{#each dates as date (date)}
						<tr>
							<th scope="row">{formatBucket(date, granularity, true)}</th>
							{#each colored as s (s.key)}<td>{formatValue(valueAt(s, date), format)}</td>{/each}
						</tr>
					{/each}
				</tbody>
			{:else}
				<tbody>
					{#each categories as d (d.key)}
						<tr><th scope="row">{d.label}</th><td>{formatValue(d.value, format)}</td></tr>
					{/each}
				</tbody>
			{/if}
		</table>
	{/snippet}
</ChartFrame>
