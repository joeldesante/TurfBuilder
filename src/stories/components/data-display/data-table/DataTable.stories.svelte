<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import DataTable from './DataTable.svelte';
	import type { DataTableColumn } from './DataTable.svelte';

	type Row = { id: string; name: string; email: string; members: number; joined: string };

	const { Story } = defineMeta({
		title: 'Components/Data Display/DataTable',
		tags: ['autodocs']
	});

	const data: Row[] = [
		{
			id: '1',
			name: 'Ada Lovelace',
			email: 'ada@example.com',
			members: 1284,
			joined: 'Jan 4, 2026'
		},
		{
			id: '2',
			name: 'Grace Hopper',
			email: 'grace@example.com',
			members: 96,
			joined: 'Mar 18, 2026'
		},
		{ id: '3', name: 'Alan Turing', email: 'alan@example.com', members: 7, joined: 'Jun 2, 2026' }
	];

	const columns: DataTableColumn<Row>[] = [
		{ id: 'name', accessorKey: 'name', header: 'Name' },
		{ id: 'email', accessorKey: 'email', header: 'Email', hideBelow: 'md' },
		{
			id: 'members',
			accessorKey: 'members',
			header: 'Members',
			align: 'right',
			tabular: true
		},
		{ id: 'joined', accessorKey: 'joined', header: 'Joined', hideBelow: 'sm', nowrap: true }
	];
</script>

<Story name="Default">
	{#snippet template()}
		<DataTable {data} {columns} getRowId={(row) => row.id} />
	{/snippet}
</Story>

<Story name="Sortable">
	{#snippet template()}
		<DataTable {data} {columns} sorting getRowId={(row) => row.id} />
	{/snippet}
</Story>

<Story name="Empty">
	{#snippet template()}
		<DataTable data={[]} {columns} empty="No members yet." />
	{/snippet}
</Story>

<Story name="Without a border">
	{#snippet template()}
		<DataTable {data} {columns} bordered={false} />
	{/snippet}
</Story>
