<script lang="ts">
	import Time from 'svelte-time/Time.svelte';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import DataTable from '$components/data-display/data-table/DataTable.svelte';

	let { data } = $props();

	const users = data.users;
	type User = (typeof users)[number];
</script>

{#snippet roleCell({ value }: { value: unknown; row: User })}
	<span>{(value as string) || 'user'}</span>
{/snippet}

{#snippet bannedCell({ value }: { value: unknown; row: User })}
	<span>{value ? 'Yes' : 'No'}</span>
{/snippet}

{#snippet createdCell({ value }: { value: unknown; row: User })}
	<Time timestamp={value as string | Date} format="MMM DD, YYYY" />
{/snippet}

<svelte:head>
	<title>Users | {data.config.application_name}</title>
</svelte:head>

<PageHeader title="Users" />

<DataTable
	data={users}
	columns={[
		{ id: 'name', accessorKey: 'name', header: 'Name' },
		{ id: 'username', accessorKey: 'username', header: 'Username' },
		{ id: 'email', accessorKey: 'email', header: 'Email' },
		{ id: 'role', accessorKey: 'role', header: 'Role', cell: roleCell },
		{ id: 'banned', accessorKey: 'banned', header: 'Banned', cell: bannedCell },
		{ id: 'created_at', accessorKey: 'created_at', header: 'Created', cell: createdCell }
	]}
	sorting
	pagination
/>
