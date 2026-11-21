<script lang="ts">
	import UniverseIntegrationsPage from '$pages/o/s/universe/data/integrations/UniverseIntegrationsPage.svelte';
	import { invalidateAll } from '$app/navigation';
	import { api } from '$lib/client/api';

	const { data } = $props();

	async function onToggle(id: string, enabled: boolean) {
		await api(`/integrations/${encodeURIComponent(id)}`, { method: 'PATCH', body: { enabled } });
		await invalidateAll();
	}
</script>

<UniverseIntegrationsPage integrations={data.integrations} orgSlug={data.orgSlug} {onToggle} />
