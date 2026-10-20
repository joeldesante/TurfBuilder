<script lang="ts">
	import InfraOverviewPage from '$pages/infra/overview/InfraOverviewPage.svelte';

	const { data } = $props();
</script>

<svelte:head><title>Overview | Infrastructure</title></svelte:head>

<InfraOverviewPage overview={data.overview} permissions={data.infraPermissions} />
