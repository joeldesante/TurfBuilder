<script lang="ts">
	import '$lib/charts.css';
	import * as Plot from '@observablehq/plot';
	import { chartTheme } from '$lib/chart-theme';

	interface Props {
		title?: string;
		subtitle?: string;
		options: Plot.PlotOptions;
	}

	let { title, subtitle, options }: Props = $props();

	let containerEl: HTMLDivElement;

	$effect(() => {
		if (!containerEl) return;
		const chart = Plot.plot({ ...chartTheme, ...options });
		containerEl.replaceChildren(chart);
		return () => chart.remove();
	});
</script>

<figure>
	{#if title}
		<figcaption class="text-lg font-semibold text-on-surface">{title}</figcaption>
	{/if}
	{#if subtitle}
		<p class="text-xs text-on-surface-subtle">{subtitle}</p>
	{/if}
	<div class="mt-4" bind:this={containerEl}></div>
</figure>
