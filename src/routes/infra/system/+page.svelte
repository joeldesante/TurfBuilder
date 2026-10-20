<script lang="ts">
	import InfraSystemPage from '$pages/infra/system/InfraSystemPage.svelte';

	const { data } = $props();
</script>

<svelte:head><title>System health | Infrastructure</title></svelte:head>

<InfraSystemPage health={data.health} permissions={data.infraPermissions} />
