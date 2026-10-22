<script lang="ts">
	import ChartFrame from '../ChartFrame/ChartFrame.svelte';
	import ChartTooltip from '../ChartTooltip/ChartTooltip.svelte';
	import { formatValue } from '$lib/shared/utils/chart-format';
	import type { MatrixCell, ValueFormat } from '$lib/shared/types/charts';

	interface Props {
		title: string;
		subtitle?: string;
		cells: MatrixCell[];
		/** Row keys in display order. */
		rows: string[];
		/** Column keys in display order. */
		cols: string[];
		rowLabel?: (row: string) => string;
		colLabel?: (col: string) => string;
		format?: ValueFormat;
		/** The color scale's top; defaults to the largest value. Use 1 for shares. */
		max?: number;
		/** Print each cell's value inside it, when cells are wide enough. */
		cellLabels?: boolean;
		/** What the rows and columns are, for the table and tooltip. */
		rowTitle?: string;
		colTitle?: string;
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
		cells,
		rows,
		cols,
		rowLabel = (r) => r,
		colLabel = (c) => c,
		format = 'number',
		max,
		cellLabels = true,
		rowTitle = 'Row',
		colTitle = 'Column',
		loading = false,
		error = null,
		emptyText,
		csvFilename,
		class: className = ''
	}: Props = $props();

	const STEPS = 7;
	const lookup = $derived(new Map(cells.map((c) => [`${c.row}\u0000${c.col}`, c.value])));
	const top = $derived(max ?? Math.max(0, ...cells.map((c) => c.value ?? 0)));
	const empty = $derived(cells.every((c) => c.value === null));

	const CELL_H = 26;
	const height = $derived(rows.length * CELL_H + 28);

	function valueOf(row: string, col: string): number | null | undefined {
		return lookup.get(`${row}\u0000${col}`);
	}

	/** Which of the seven ramp steps a value falls in; the top value lands in the last. */
	function stepOf(value: number): number {
		return top > 0 ? Math.max(0, Math.min(STEPS - 1, Math.floor((value / top) * STEPS))) : 0;
	}

	/** One of seven steps of the sequential ramp; the empty color for no data. */
	function fill(value: number | null | undefined): string {
		if (value === null || value === undefined) return 'var(--chart-seq-empty)';
		return `var(--chart-seq-${(stepOf(value) + 1) * 100})`;
	}

	/** The label color for a cell: each ramp step has its own ink, since the ramp runs the other way in dark theme. */
	function ink(value: number | null | undefined): string {
		if (value === null || value === undefined) return 'var(--chart-ink-muted)';
		return `var(--chart-seq-ink-${(stepOf(value) + 1) * 100})`;
	}

	let active = $state<{ row: string; col: string; x: number; y: number } | null>(null);

	function csv(): string {
		const lines = [[rowTitle, ...cols.map(colLabel)].join(',')];
		for (const row of rows) lines.push([rowLabel(row), ...cols.map((c) => valueOf(row, c) ?? '')].join(','));
		return lines.join('\n');
	}
</script>

<ChartFrame class={className} {title} {subtitle} {height} {loading} {error} {empty} {emptyText} {csv} {csvFilename}>
	{#snippet legend()}
		<div class="flex items-center gap-2 text-xs text-on-surface-subtle" aria-hidden="true">
			<span>{formatValue(0, format)}</span>
			<span class="flex gap-0.5">
				{#each Array.from({ length: STEPS }, (_, i) => i) as i (i)}
					<span class="h-2.5 w-4 rounded-sm" style:background={`var(--chart-seq-${(i + 1) * 100})`}></span>
				{/each}
			</span>
			<span>{formatValue(top, format)}</span>
			<span class="ml-2 flex items-center gap-1">
				<span class="h-2.5 w-4 rounded-sm" style:background="var(--chart-seq-empty)"></span>No data
			</span>
		</div>
	{/snippet}

	{#snippet children(width: number)}
		{@const labelW = Math.min(120, width * 0.25)}
		{@const cellW = Math.max(6, (width - labelW) / Math.max(1, cols.length))}
		{@const showText = cellLabels && cellW >= 34}
		{@const colEvery = Math.max(1, Math.ceil(28 / cellW))}
		<svg {width} {height} role="img" aria-label={`${title}. ${rows.length} rows by ${cols.length} columns; the table has every value.`} class="overflow-visible">
			{#each cols as col, ci (col)}
				{#if ci % colEvery === 0}
					<text x={labelW + ci * cellW + cellW / 2} y="12" text-anchor="middle" font-size="11" fill="var(--chart-ink-muted)">{colLabel(col)}</text>
				{/if}
			{/each}
			{#each rows as row, ri (row)}
				{@const y0 = 22 + ri * CELL_H}
				<text x={labelW - 8} y={y0 + CELL_H / 2 - 1} dy="0.32em" text-anchor="end" font-size="11" fill="var(--on-surface-subtle)">{rowLabel(row)}</text>
				{#each cols as col, ci (col)}
					{@const v = valueOf(row, col)}
					{#if v !== undefined}
						<rect
							x={labelW + ci * cellW + 1}
							y={y0 + 1}
							width={cellW - 2}
							height={CELL_H - 2}
							rx="2"
							fill={fill(v)}
							stroke={active?.row === row && active?.col === col ? 'var(--on-surface)' : 'none'}
							stroke-width="1.5"
							role="presentation"
							onpointerenter={() => (active = { row, col, x: labelW + ci * cellW + cellW / 2, y: y0 })}
							onpointerleave={() => (active = null)}
						/>
						{#if showText && v !== null}
							<text x={labelW + ci * cellW + cellW / 2} y={y0 + CELL_H / 2} dy="0.32em" text-anchor="middle" font-size="10" fill={ink(v)} pointer-events="none" class="tabular-nums">
								{formatValue(v, format === 'number' ? 'compact' : format)}
							</text>
						{/if}
					{/if}
				{/each}
			{/each}
		</svg>
		{#if active}
			{@const v = valueOf(active.row, active.col)}
			<ChartTooltip
				heading={`${rowLabel(active.row)}, ${colLabel(active.col)}`}
				x={active.x}
				y={active.y + CELL_H}
				containerWidth={width}
				rows={[{ color: fill(v), label: title, value: v === null || v === undefined ? 'No data' : formatValue(v, format) }]}
			/>
		{/if}
	{/snippet}

	{#snippet table()}
		<table>
			<caption>{title}</caption>
			<thead><tr><th scope="col">{rowTitle}</th>{#each cols as col (col)}<th scope="col">{colLabel(col)}</th>{/each}</tr></thead>
			<tbody>
				{#each rows as row (row)}
					<tr>
						<th scope="row">{rowLabel(row)}</th>
						{#each cols as col (col)}
							{@const v = valueOf(row, col)}
							<td>{v === null || v === undefined ? '' : formatValue(v, format)}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	{/snippet}
</ChartFrame>
