<script lang="ts" module>
	import type { Granularity } from '$lib/shared/types/charts';
	import type { DashboardRange } from '$lib/dashboard-range';

	export interface RangeValue {
		range: DashboardRange;
		granularity: Granularity;
	}

	export const RANGE_PRESETS: { value: DashboardRange; label: string; granularity: Granularity }[] = [
		{ value: '7d', label: '7 days', granularity: 'day' },
		{ value: '30d', label: '30 days', granularity: 'day' },
		{ value: '90d', label: '90 days', granularity: 'week' },
		{ value: '1y', label: '1 year', granularity: 'month' },
		{ value: 'all', label: 'All time', granularity: 'month' }
	];

	/** The granularity that reads best for a range, used when the range changes. */
	export function defaultGranularity(range: DashboardRange): Granularity {
		return RANGE_PRESETS.find((p) => p.value === range)?.granularity ?? 'day';
	}
</script>

<script lang="ts">
	import { ToggleGroup } from 'bits-ui';

	interface Props {
		range: DashboardRange;
		granularity: Granularity;
		/** Called with the new range and granularity; a new range brings its usual granularity. */
		onchange: (value: RangeValue) => void;
		/** Ranges to offer; the presets by default. */
		ranges?: { value: DashboardRange; label: string }[];
		/** Hide the granularity control, for charts with a fixed bucket. */
		showGranularity?: boolean;
	}

	let { range, granularity, onchange, ranges = RANGE_PRESETS, showGranularity = true }: Props = $props();

	const granularities: { value: Granularity; label: string }[] = [
		{ value: 'day', label: 'Day' },
		{ value: 'week', label: 'Week' },
		{ value: 'month', label: 'Month' }
	];

	const group = 'inline-flex rounded-lg border border-outline bg-surface p-0.5';
	const item =
		'h-8 rounded-md px-3 text-sm text-on-surface-subtle transition-colors hover:text-on-surface data-[state=on]:bg-surface-container-high data-[state=on]:font-medium data-[state=on]:text-on-surface focus-visible:outline-2 focus-visible:outline-primary';
</script>

<div class="flex flex-wrap items-center gap-2">
	<ToggleGroup.Root
		type="single"
		value={range}
		onValueChange={(next) => next && onchange({ range: next, granularity: defaultGranularity(next) })}
		aria-label="Time range"
		class="{group} max-w-full overflow-x-auto"
	>
		{#each ranges as option (option.value)}
			<ToggleGroup.Item value={option.value} class={item}>{option.label}</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>

	{#if showGranularity}
		<ToggleGroup.Root
			type="single"
			value={granularity}
			onValueChange={(next) => next && onchange({ range, granularity: next as Granularity })}
			aria-label="Group by"
			class={group}
		>
			{#each granularities as option (option.value)}
				<ToggleGroup.Item value={option.value} class={item}>{option.label}</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>
	{/if}
</div>
