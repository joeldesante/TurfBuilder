<script lang="ts">
	import InfraEmailTemplatesPage from '$pages/infra/settings/InfraEmailTemplatesPage.svelte';

	const { data } = $props();
</script>

<svelte:head><title>Email templates | Infrastructure</title></svelte:head>

<InfraEmailTemplatesPage templates={data.templates} />
