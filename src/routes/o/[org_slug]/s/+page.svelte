<script lang="ts">
	import { authClient } from '$lib/client';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	const { data } = $props();
</script>

<svelte:head>
	<title>Dashboard | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<PageHeader
	title="Dashboard"
	subheading="This will be the main portal for the system, giving a high level overview of important data and quick links to other pages."
/>

<div class="p-6">
	<Button variant="outline" href="/o/{data.organization.slug}/join">Join a Turf</Button>
</div>
