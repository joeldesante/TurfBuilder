<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ChartFrame from './ChartFrame.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Display/Charts/ChartFrame',
		component: ChartFrame,
		tags: ['autodocs'],
		parameters: {
			docs: {
				subtitle:
					'The card every chart sits in: title, actions, CSV download, legend, a measured plot area of fixed height, and loading, error, and empty states. Build new chart types inside it.'
			}
		}
	});
</script>

{#snippet plot(width: number)}
	<div class="flex h-full items-center justify-center rounded border border-dashed border-outline text-sm text-on-surface-subtle">
		Plot area, {Math.round(width)}px wide
	</div>
{/snippet}

<Story name="With a plot" args={{ title: 'Any chart', subtitle: 'Last 30 days', csv: () => 'a,b' }}>
	{#snippet template(args)}<ChartFrame {...args}>{#snippet children(w)}{@render plot(w)}{/snippet}</ChartFrame>{/snippet}
</Story>

<Story name="Loading" args={{ title: 'Any chart', loading: true }}>
	{#snippet template(args)}<ChartFrame {...args}>{#snippet children(w)}{@render plot(w)}{/snippet}</ChartFrame>{/snippet}
</Story>

<Story name="Error" args={{ title: 'Any chart', error: 'The chart could not be loaded.' }}>
	{#snippet template(args)}<ChartFrame {...args}>{#snippet children(w)}{@render plot(w)}{/snippet}</ChartFrame>{/snippet}
</Story>

<Story name="Empty" args={{ title: 'Any chart', empty: true }}>
	{#snippet template(args)}<ChartFrame {...args}>{#snippet children(w)}{@render plot(w)}{/snippet}</ChartFrame>{/snippet}
</Story>
