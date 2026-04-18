<script lang="ts">
	import InfraDashboard from '$pages/infra/InfraDashboard.svelte';

	const { data } = $props();
</script>

<InfraDashboard infraPermissions={data.infraPermissions} />
