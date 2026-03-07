<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import DataTable from '$components/data-display/data-table/DataTable.svelte';

	let { data } = $props();

	const locations = data.locations;
</script>

<svelte:head>
	<title>Locations | {data.config.application_name}</title>
</svelte:head>

<PageHeader title="Locations" />

<DataTable
	data={locations}
	columns={[
		{ id: 'location_name', accessorKey: 'location_name', header: 'Name' },
		{ id: 'category', accessorKey: 'category', header: 'Category' },
		{ id: 'street', accessorKey: 'street', header: 'Street' },
		{ id: 'locality', accessorKey: 'locality', header: 'Locality' },
		{ id: 'postcode', accessorKey: 'postcode', header: 'Postcode' },
		{ id: 'region', accessorKey: 'region', header: 'Region' },
		{ id: 'country', accessorKey: 'country', header: 'Country' }
	]}
	sorting
	pagination
/>
