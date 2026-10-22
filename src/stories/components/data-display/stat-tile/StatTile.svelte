<script lang="ts">
	import Sparkline from '$components/data-display/charts/Sparkline/Sparkline.svelte';
	import ArrowUpIcon from 'phosphor-svelte/lib/ArrowUp';
	import ArrowDownIcon from 'phosphor-svelte/lib/ArrowDown';
	import { formatChange, formatValue } from '$lib/shared/utils/chart-format';
	import type { TimePoint, ValueFormat } from '$lib/shared/types/charts';

	interface Props {
		label: string;
		value: number | string;
		format?: ValueFormat;
		/** Change against the previous period as a fraction (0.12 is up 12%); null when there was nothing before. Omit for none. */
		change?: number | null;
		/** Which way is good: more sign-ups is up, more failed emails is down. */
		goodDirection?: 'up' | 'down' | 'none';
		/** What the change compares against, such as "vs the 7 days before". */
		changeLabel?: string;
		/** A small trend under the value. */
		trend?: TimePoint[];
		/** Extra context under the value. */
		hint?: string;
		/** Makes the tile a link, such as to the full chart. */
		href?: string;
	}

	let {
		label,
		value,
		format = 'number',
		change,
		goodDirection = 'up',
		changeLabel,
		trend,
		hint,
		href
	}: Props = $props();

	const shown = $derived(typeof value === 'number' ? formatValue(value, format) : value);
	const direction = $derived(change === undefined || change === null || change === 0 ? 'flat' : change > 0 ? 'up' : 'down');
	const tone = $derived(
		goodDirection === 'none' || direction === 'flat'
			? 'var(--on-surface-subtle)'
			: direction === goodDirection
				? 'var(--chart-delta-good)'
				: 'var(--chart-delta-bad)'
	);
	const changeText = $derived(change === undefined ? null : formatChange(change));
	const changeWords = $derived(
		change === undefined
			? ''
			: change === null
				? 'new this period'
				: change === 0
					? 'no change'
					: `${direction === 'up' ? 'up' : 'down'} ${Math.abs(Math.round(change * 100))}%`
	);
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	class="flex min-w-0 flex-col rounded-xl border border-outline-subtle bg-surface p-4 no-underline {href
		? 'transition-colors hover:bg-surface-container-low'
		: ''}"
>
	<span class="text-sm text-on-surface-subtle">{label}</span>
	<span class="mt-1 text-2xl font-semibold text-on-surface">{shown}</span>
	{#if changeText}
		<span class="mt-1 flex items-center gap-1 text-xs" style:color={tone}>
			{#if direction === 'up'}<ArrowUpIcon class="size-3" weight="bold" />{:else if direction === 'down'}<ArrowDownIcon class="size-3" weight="bold" />{/if}
			<span aria-hidden="true">{changeText}</span>
			<span class="sr-only">{changeWords}</span>
			{#if changeLabel}<span class="text-on-surface-subtle">{changeLabel}</span>{/if}
		</span>
	{/if}
	{#if hint}<span class="mt-1 text-xs text-on-surface-subtle">{hint}</span>{/if}
	{#if trend && trend.length > 1}
		<div class="mt-3"><Sparkline points={trend} label={label} /></div>
	{/if}
</svelte:element>
