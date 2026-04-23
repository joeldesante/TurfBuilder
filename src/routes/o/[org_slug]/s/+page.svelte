<script lang="ts">
	import { authClient } from '$lib/client';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
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
	<a
		href="/o/{data.organization.slug}/join"
		class="inline-block px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors"
	>
		Join a Turf
	</a>
</div>
