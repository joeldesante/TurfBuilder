<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Legend from './Legend.svelte';

	const items = [
		{ key: 'a', label: 'Daily active', color: 'var(--chart-1)' },
		{ key: 'b', label: 'Weekly active', color: 'var(--chart-2)' },
		{ key: 'c', label: 'Previous period', color: 'var(--chart-other)', dashed: true }
	];

	const { Story } = defineMeta({
		title: 'Components/Data Display/Charts/Legend',
		component: Legend,
		tags: ['autodocs'],
		parameters: {
			docs: { subtitle: 'Names each series by its color. Given ontoggle, each item hides or shows its series.' }
		}
	});
</script>

<Story name="Static" args={{ items }} />

<Story name="Toggles" args={{ items, hidden: ['b'], ontoggle: () => {} }} />

<Story name="With values" args={{ vertical: true, items: items.map((i, n) => ({ ...i, value: `${(n + 1) * 120}` })) }} />
