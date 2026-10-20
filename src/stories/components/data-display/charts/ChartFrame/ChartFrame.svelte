<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Spinner from '$components/feedback/spinner/Spinner.svelte';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimple';
	import { downloadCsv } from '../chart-utils';

	interface Props {
		title: string;
		subtitle?: string;
		/** Height of the plot area in px; the frame reserves it before the chart draws, so nothing jumps. */
		height?: number;
		loading?: boolean;
		/** Shown in place of the chart. Write it for people. */
		error?: string | null;
		/** True when there is nothing to draw. */
		empty?: boolean;
		emptyText?: string;
		/** Builds the chart's data as CSV; adds a download button when given. */
		csv?: () => string;
		csvFilename?: string;
		/** Extra controls in the header, beside the download button. */
		actions?: Snippet;
		/** The legend, between the header and the plot. */
		legend?: Snippet;
		/** The plot, given the measured width in px. Not rendered until the width is known. */
		children: Snippet<[number]>;
		/** The same data as a table, for screen readers. */
		table?: Snippet;
		class?: string;
	}

	let {
		title,
		subtitle,
		height = 240,
		loading = false,
		error = null,
		empty = false,
		emptyText = 'No data for this period.',
		csv,
		csvFilename,
		actions,
		legend,
		children,
		table,
		class: className = ''
	}: Props = $props();

	let width = $state(0);

	const slug = $derived(title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
</script>

<figure class="min-w-0 rounded-xl border border-outline-subtle bg-surface p-4 {className}">
	<figcaption class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			<h3 class="text-sm font-medium text-on-surface">{title}</h3>
			{#if subtitle}<p class="text-xs text-on-surface-subtle">{subtitle}</p>{/if}
		</div>
		<div class="flex shrink-0 items-center gap-1">
			{@render actions?.()}
			{#if csv && !empty && !loading && !error}
				<Button
					variant="ghost"
					size="sm"
					iconOnly
					aria-label={`Download ${title} as CSV`}
					title="Download CSV"
					onclick={() => downloadCsv(csvFilename ?? slug, csv())}
				>
					<DownloadSimpleIcon />
				</Button>
			{/if}
		</div>
	</figcaption>

	{#if legend && !empty && !loading && !error}
		<div class="mt-3">{@render legend()}</div>
	{/if}

	<div class="relative mt-3" style:height="{height}px" bind:clientWidth={width}>
		{#if loading}
			<div class="absolute inset-0 flex items-center justify-center" role="status">
				<Spinner />
				<span class="sr-only">Loading {title}</span>
			</div>
		{:else if error}
			<div class="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-on-surface-subtle" role="alert">
				{error}
			</div>
		{:else if empty}
			<div class="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-on-surface-subtle">
				{emptyText}
			</div>
		{:else if width > 0}
			{@render children(width)}
		{/if}
	</div>

	{#if table && !empty && !loading && !error}
		<div class="sr-only">{@render table()}</div>
	{/if}
</figure>
