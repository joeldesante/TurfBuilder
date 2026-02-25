<script lang="ts">
	import { authClient } from '$lib/client';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	const { data } = $props();
	const session = authClient.useSession();
</script>

<svelte:head>
	<title>Dashboard | {data.config.application_name}</title>
</svelte:head>

<PageHeader title="Dashboard" />

<div>
	<p>
		Main portal with a grand overview of important data. includes links to certain pages like the
		list of users, list of turfs, maybe even a master location list
	</p>
</div>
