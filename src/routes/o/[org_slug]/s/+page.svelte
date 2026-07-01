<script lang="ts">
	import StaffDashboardPage from '$pages/o/s/dashboard/StaffDashboardPage.svelte';
	const { data } = $props();
</script>

<svelte:head>
	<title>Dashboard | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<StaffDashboardPage
	orgSlug={data.organization.slug}
	applicationName={data.config?.application_name ?? 'TurfBuilder'}
/>
