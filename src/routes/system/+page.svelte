<script lang="ts">
	import { authClient } from '$lib/client';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	const { data } = $props();
	const session = authClient.useSession();
</script>

<svelte:head>
	<title>Dashboard | {data.config.application_name}</title>
</svelte:head>

<PageHeader 
	title="Dashboard"
	subheading="This will be the main portal for the system, giving a high level overview of important data and quick links to other pages." 
/>

