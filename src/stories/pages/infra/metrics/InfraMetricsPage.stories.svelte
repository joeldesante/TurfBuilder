<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraMetricsPage from './InfraMetricsPage.svelte';
	import { metrics } from './fixtures';

	const { Story } = defineMeta({
		title: 'Pages/Infra/Metrics',
		component: InfraMetricsPage,
		tags: ['autodocs'],
		args: { onrange: () => {} },
		parameters: {
			layout: 'fullscreen',
			docs: { subtitle: 'Every platform chart in one place, with a range and granularity control that lives in the URL.' }
		}
	});
</script>

<Story name="Metrics" args={{ metrics }} />

<Story
	name="Quiet instance"
	args={{
		metrics: {
			...metrics,
			signups: { kind: 'series', title: 'New accounts', format: 'number', series: [] },
			top_orgs: { kind: 'categories', title: 'Most active organizations', format: 'number', data: [] }
		}
	}}
/>
