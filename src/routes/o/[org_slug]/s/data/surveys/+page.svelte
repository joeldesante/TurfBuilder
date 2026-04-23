<script lang="ts">
	import Time from 'svelte-time/Time.svelte';
	import { ArrowRightIcon, PlusIcon } from 'phosphor-svelte';
	import { page } from '$app/stores';
	import Button from '$components/actions/button/Button.svelte';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import DataTable from '$components/data-display/data-table/DataTable.svelte';

	let { data } = $props();

	const surveys = data.surveys;
	const orgSlug = $page.params.org_slug;
	type Survey = (typeof surveys)[number];
</script>

{#snippet createdCell({ value }: { value: unknown; row: Survey })}
	<Time timestamp={value as string | Date} format="MMM DD, YYYY" />
{/snippet}

{#snippet actionsCell({ row }: { value: unknown; row: Survey })}
	<Button variant="ghost" href="/o/{orgSlug}/s/data/surveys/{row.id}" size="sm">
		<ArrowRightIcon />
	</Button>
{/snippet}

<svelte:head>
	<title>Surveys | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<PageHeader title="Surveys">
	{#snippet actions()}
		<Button variant="primary" href="/o/{orgSlug}/s/data/surveys/create">
			<PlusIcon />
			Create Survey
		</Button>
	{/snippet}
</PageHeader>

<DataTable
	data={surveys}
	columns={[
		{ id: 'name', accessorKey: 'name', header: 'Name' },
		{ id: 'description', accessorKey: 'description', header: 'Description' },
		{ id: 'created_at', accessorKey: 'created_at', header: 'Created', cell: createdCell },
		{ id: 'actions', accessorKey: 'id', header: '', cell: actionsCell, enableSorting: false }
	]}
	sorting
	pagination
/>
