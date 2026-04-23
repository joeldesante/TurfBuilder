<script lang="ts">
	import Time from 'svelte-time/Time.svelte';
	import { page } from '$app/stores';
	import Button from '$components/actions/button/Button.svelte';
	import CopyButton from '$components/actions/copy-button/CopyButton.svelte';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import DataTable from '$components/data-display/data-table/DataTable.svelte';

	let { data } = $props();

	const turfs = data.turfs;
	const orgSlug = $page.params.org_slug;
	type Turf = (typeof turfs)[number];
</script>

{#snippet codeCell({ value }: { value: unknown; row: Turf })}
	<div class="flex items-center gap-1">
		<span>{value as string}</span>
		<CopyButton value={String(value)} aria-label="Copy turf code" />
	</div>
{/snippet}

{#snippet createdCell({ value }: { value: unknown; row: Turf })}
	<Time timestamp={value as string | Date} format="MMM DD, YYYY h:mm A" />
{/snippet}

{#snippet expiresCell({ value }: { value: unknown; row: Turf })}
	{@const daysLeft = Math.ceil((new Date(value as string).getTime() - Date.now()) / 86400000)}
	<span>
		<Time timestamp={value as string | Date} format="MMM DD, YYYY" />
		<span class="text-on-surface-subtle text-xs ml-1">({daysLeft}d)</span>
	</span>
{/snippet}

<svelte:head>
	<title>Turfs | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<PageHeader title="Turfs">
	{#snippet actions()}
		<Button variant="primary" href="/o/{orgSlug}/s/turfs/cut">Cut Turfs</Button>
	{/snippet}
</PageHeader>

<DataTable
	data={turfs}
	columns={[
		{ id: 'code', accessorKey: 'code', header: 'Code', cell: codeCell },
		{ id: 'username', accessorKey: 'username', header: 'Author' },
		{ id: 'survey_name', accessorKey: 'survey_name', header: 'Survey' },
		{ id: 'created_at', accessorKey: 'created_at', header: 'Created', cell: createdCell },
		{ id: 'expires_at', accessorKey: 'expires_at', header: 'Expires', cell: expiresCell }
	]}
	sorting
	pagination
/>
