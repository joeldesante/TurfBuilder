<script lang="ts">
	import { untrack } from 'svelte';
	import * as Plot from '@observablehq/plot';
	import LineChart, { type Granularity } from '$components/data-display/charts/LineChart/LineChart.svelte';
	import Card from '$components/layout/card/Card.svelte';
	import PieChart from '$components/data-display/charts/PieChart/PieChart.svelte';

	type Range = '1w' | '1m' | '3m' | '6m' | '1y';

	interface Props {
		orgSlug: string;
		applicationName: string;
		mockTimeSeries?: TimeSeriesPoint[];
		initialRange?: Range;
	}

	const { orgSlug, mockTimeSeries, initialRange = '1m' }: Props = $props();

	const RANGE_GRANULARITY: Record<Range, Granularity> = {
		'1w': 'day',
		'1m': 'week',
		'3m': 'month',
		'6m': 'month',
		'1y': 'month'
	};

	const RANGE_LABELS: Record<Range, string> = {
		'1w': '1 Week',
		'1m': '1 Month',
		'3m': '3 Months',
		'6m': '6 Months',
		'1y': '1 Year'
	};

	const RANGE_DAYS: Record<Range, number> = {
		'1w': 7,
		'1m': 30,
		'3m': 90,
		'6m': 180,
		'1y': 365
	};

	let range = $state<Range>(untrack(() => initialRange));

	interface TimeSeriesPoint {
		date: string;
		count: number;
	}

	interface OutcomeRow {
		contact_made: boolean | null;
		count: number;
	}

	let timeSeries = $state<TimeSeriesPoint[]>(untrack(() => mockTimeSeries ?? []));
	let outcomes = $state<OutcomeRow[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	async function fetchData(r: Range) {
		loading = true;
		error = null;
		try {
			const res = await fetch(`/o/${orgSlug}/s/api/dashboard?range=${r}`);
			if (!res.ok) throw new Error('Failed to load dashboard data');
			const data = await res.json();
			timeSeries = data.timeSeries;
			outcomes = data.outcomes;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (!mockTimeSeries) fetchData(range);
	});

	const pieData = $derived(
		outcomes.map((row) => ({
			label:
				row.contact_made === true
					? 'Contact Made'
					: row.contact_made === false
						? 'Not Home'
						: 'Unknown',
			value: row.count,
			color:
				row.contact_made === true
					? 'var(--success)'
					: row.contact_made === false
						? 'var(--error)'
						: 'var(--on-surface-subtle)'
		}))
	);

	const dailyData = $derived(() => {
		const countByDay = new Map(
			timeSeries.map((d) => [new Date(d.date).toISOString().slice(0, 10), d.count])
		);
		const days: { date: Date; count: number }[] = [];
		const today = new Date();
		today.setUTCHours(0, 0, 0, 0);
		for (let i = RANGE_DAYS[range]; i >= 0; i--) {
			const d = new Date(today);
			d.setUTCDate(d.getUTCDate() - i);
			const key = d.toISOString().slice(0, 10);
			days.push({ date: d, count: countByDay.get(key) ?? 0 });
		}
		return days;
	});

	const cumulativeData = $derived(
		dailyData().reduce<{ date: Date; total: number; count: number }[]>((acc, d) => {
			const prev = acc.at(-1)?.total ?? 0;
			acc.push({ date: d.date, total: prev + d.count, count: d.count });
			return acc;
		}, [])
	);

	const yMax = $derived(Math.max(1, ...cumulativeData.map((d) => d.total)));

	const yTicks = $derived(() => {
		const maxTicks = 6;
		if (yMax <= maxTicks) return Array.from({ length: yMax + 1 }, (_, i) => i);
		const step = Math.ceil(yMax / maxTicks);
		const ticks = [];
		for (let i = 0; i <= yMax; i += step) ticks.push(i);
		return ticks;
	});

	const chartOptions = $derived({
		x: { label: 'Date' },
		y: { label: 'Total Attempts', grid: true, domain: [0, yMax], ticks: yTicks() },
		marks: [
			Plot.rectY(dailyData(), {
				x: 'date',
				y: 'count',
				interval: 'day',
				fill: 'var(--on-surface-subtle)',
				fillOpacity: 0.4
			}),
			Plot.lineY(cumulativeData, {
				x: 'date',
				y: 'total',
				stroke: 'var(--on-surface)'
			}),
			Plot.dot(
				cumulativeData.filter((d) => d.count > 0),
				{ x: 'date', y: 'total', stroke: 'var(--on-surface)' }
			),
			Plot.tip(dailyData(), Plot.pointerX({ x: 'date', y: 'count' }))
		]
	});
</script>

<div class="mb-4 flex items-center justify-between">
	<h2 class="text-lg font-semibold">Dashboard</h2>
	<div class="flex gap-1">
		{#each Object.entries(RANGE_LABELS) as [key, label]}
			<button
				class="rounded px-3 py-1 text-sm transition-colors"
				class:bg-primary={range === key}
				class:text-on-primary={range === key}
				class:bg-surface-container={range !== key}
				class:text-on-surface={range !== key}
				onclick={() => (range = key as Range)}
			>
				{label}
			</button>
		{/each}
	</div>
</div>

{#if error}
	<p class="text-error mb-4 text-sm">{error}</p>
{/if}

<div class="flex gap-4" class:opacity-50={loading}>
	<Card>
		<LineChart
			granularity={RANGE_GRANULARITY[range]}
			series={[
				{
					name: 'Cumulative Attempts',
					color: 'var(--primary)',
					showArea: true,
					data: cumulativeData.map((d) => ({ date: d.date, qty: d.total }))
				}
			]}
		/>
	</Card>

	<Card>
		<PieChart
			title="Attempt Outcomes"
			subtitle={'Breakdown of contact made vs. not home for the selected period.'}
			data={pieData}
			legend
		/>
	</Card>
</div>
