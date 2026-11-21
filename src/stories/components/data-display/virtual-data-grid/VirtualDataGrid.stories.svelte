<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import VirtualDataGrid from './VirtualDataGrid.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Display/VirtualDataGrid',
		component: VirtualDataGrid,
		tags: ['autodocs']
	});

	const columns = ['First Name', 'Last Name', 'Sex', 'Phone'];

	/** Made-up rows, after a short wait like a real source would take. */
	async function loadRows(offset: number, limit: number, total: number): Promise<string[][]> {
		await new Promise((resolve) => setTimeout(resolve, 300));
		return Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => {
			const n = offset + i + 1;
			return [
				`First ${n}`,
				`Last ${n}`,
				n % 2 ? 'Female' : 'Male',
				`555-${String(n).padStart(7, '0')}`
			];
		});
	}
</script>

<Story
	name="300,000 rows"
	exportName="ManyRows"
	args={{
		columns,
		totalRows: 300_000,
		loadRows: (o: number, l: number) => loadRows(o, l, 300_000)
	}}
/>

<Story
	name="A few rows"
	args={{ columns, totalRows: 5, loadRows: (o: number, l: number) => loadRows(o, l, 5) }}
/>

<Story
	name="With page jumper"
	args={{
		columns,
		totalRows: 300_000,
		pageJumper: true,
		loadRows: (o: number, l: number) => loadRows(o, l, 300_000)
	}}
/>
