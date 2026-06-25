<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PieChart from './PieChart.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Display/Charts/PieChart',
		component: PieChart,
		tags: ['autodocs'],
		argTypes: {
			radius: { control: { type: 'number' } },
			innerRadius: { control: { type: 'number' } },
			tooltip: { control: { type: 'boolean' } },
			legend: { control: { type: 'boolean' } }
		}
	});

	const responses = [
		{ label: 'Supportive', value: 42 },
		{ label: 'Undecided', value: 28 },
		{ label: 'Unsupportive', value: 18 },
		{ label: 'No Contact', value: 12 }
	];
</script>

<Story name="Default" args={{ data: responses }} />

<Story name="With Title" args={{ data: responses, title: 'Canvassing Responses', subtitle: 'Last 30 days', legend: true }} />

<Story name="With Legend" args={{ data: responses, legend: true }} />

<Story name="Donut" args={{ data: responses, innerRadius: 60, legend: true }} />

<Story name="Custom Colors" args={{
	data: responses,
	legend: true,
	colors: ['var(--primary)', 'var(--secondary)', 'var(--error)', 'var(--outline)']
}} />

<Story name="No Tooltip" args={{ data: responses, tooltip: false, legend: true }} />
