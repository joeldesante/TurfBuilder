<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import RangePicker, { type RangeValue } from '$components/data-inputs/range-picker/RangePicker.svelte';
	import LineChart from '$components/data-display/charts/LineChart/LineChart.svelte';
	import BarChart from '$components/data-display/charts/BarChart/BarChart.svelte';
	import DonutChart from '$components/data-display/charts/DonutChart/DonutChart.svelte';
	import Heatmap from '$components/data-display/charts/Heatmap/Heatmap.svelte';
	import { formatBucket } from '$lib/shared/utils/chart-format';
	import type { MetricResult, PlatformMetricKey, PlatformMetrics } from '$lib/shared/types/metrics';

	interface Props {
		metrics: PlatformMetrics;
		/** Called when the range or granularity changes; the route puts them in the URL. */
		onrange: (value: RangeValue) => void;
	}

	let { metrics, onrange }: Props = $props();

	interface Section {
		title: string;
		blurb: string;
		keys: PlatformMetricKey[];
	}

	const sections: Section[] = [
		{ title: 'Growth', blurb: 'New accounts and organizations.', keys: ['signups', 'total_users', 'new_orgs'] },
		{ title: 'Engagement', blurb: 'How many people use the app, and how often.', keys: ['active_users', 'stickiness', 'sign_ins', 'retention'] },
		{ title: 'Field activity', blurb: 'What organizations do with it.', keys: ['visits', 'surveys', 'content', 'emails'] },
		{ title: 'Breakdowns', blurb: 'How the platform splits up right now.', keys: ['top_orgs', 'org_sizes', 'event_mix', 'sign_in_methods', 'two_factor', 'email_verified'] }
	];

	/** Charts that read better as areas, stacks, or ratios than as plain lines. */
	const AREA: PlatformMetricKey[] = ['total_users'];
	const STACKED: PlatformMetricKey[] = ['visits', 'content'];
	const FULL_WIDTH: PlatformMetricKey[] = ['retention', 'signups', 'active_users'];

	const csvName = (key: string) => `${key.replace(/_/g, '-')}-${metrics.window.range}`;
	const span = (key: PlatformMetricKey) => (FULL_WIDTH.includes(key) ? 'lg:col-span-2' : '');
	const retentionCol = (col: string) => (col === '0' ? 'Week of sign-up' : `Week ${col}`);
	const get = (key: PlatformMetricKey): MetricResult => metrics[key];
</script>

<PageHeader title="Metrics" subheading="Growth, engagement, and field activity across the platform." />

<div class="mb-6">
	<RangePicker range={metrics.window.range} granularity={metrics.window.granularity} onchange={onrange} />
</div>

<div class="space-y-10">
	{#each sections as section (section.title)}
		<section aria-labelledby={`section-${section.title}`}>
			<h2 id={`section-${section.title}`} class="text-lg font-medium text-on-surface">{section.title}</h2>
			<p class="mb-3 text-sm text-on-surface-subtle">{section.blurb}</p>
			<div class="grid gap-4 lg:grid-cols-2">
				{#each section.keys as key (key)}
					{@const metric = get(key)}
					{#if metric.kind === 'series'}
						<LineChart
							class={span(key)}
							title={metric.title}
							series={metric.series}
							granularity={metrics.window.granularity}
							format={metric.format}
							area={AREA.includes(key)}
							stacked={STACKED.includes(key)}
							csvFilename={csvName(key)}
						/>
					{:else if metric.kind === 'matrix'}
						<Heatmap
							class={span(key)}
							title={metric.title}
							subtitle="Share of each sign-up week still active"
							cells={metric.cells}
							rows={metric.rows}
							cols={metric.cols}
							rowLabel={(row) => formatBucket(row, 'week')}
							colLabel={retentionCol}
							rowTitle="Sign-up week"
							colTitle="Weeks since"
							format={metric.format}
							max={1}
							csvFilename={csvName(key)}
						/>
					{:else if key === 'top_orgs'}
						<BarChart
							class={span(key)}
							title={metric.title}
							subtitle="Activity events in this period"
							data={metric.data}
							format={metric.format}
							href={(d) => `/infra/orgs/${d.key}`}
							csvFilename={csvName(key)}
						/>
					{:else}
						<DonutChart class={span(key)} title={metric.title} data={metric.data} format={metric.format} csvFilename={csvName(key)} />
					{/if}
				{/each}
			</div>
		</section>
	{/each}
</div>
