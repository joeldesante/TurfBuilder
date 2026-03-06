<script lang="ts">
	import Time from 'svelte-time/Time.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import CopyButton from '$components/actions/copy-button/CopyButton.svelte';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import DataTable from '$components/data-display/data-table/DataTable.svelte';

	let { data } = $props();

	const turfs = data.turfs;
	type Turf = (typeof turfs)[number];
</script>

{#snippet codeCell({ value }: { value: unknown; row: Turf })}
	<div class="flex items-center gap-1">
		<span>{value as string}</span>
		<CopyButton value={String(value)} aria-label="Copy turf code" />
	</div>
{/snippet}

{#snippet dateCell({ value }: { value: unknown; row: Turf })}
	<Time timestamp={value as string | Date} format="MMM DD, YYYY" />
{/snippet}

<svelte:head>
	<title>Turfs | {data.config.application_name}</title>
</svelte:head>

<PageHeader title="Turfs">
	{#snippet actions()}
		<Button variant="primary" href="/system/turfs/cut">Cut Turfs</Button>
	{/snippet}
</PageHeader>

<DataTable
	data={turfs}
	columns={[
		{ id: 'code', accessorKey: 'code', header: 'Code', cell: codeCell },
		{ id: 'username', accessorKey: 'username', header: 'Author' },
		{ id: 'created_at', accessorKey: 'created_at', header: 'Created', cell: dateCell },
		{ id: 'expires_at', accessorKey: 'expires_at', header: 'Expires', cell: dateCell }
	]}
	sorting
	pagination
/>
