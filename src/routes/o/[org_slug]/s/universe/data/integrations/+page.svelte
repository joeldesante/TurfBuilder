<script lang="ts">
	import UniverseIntegrationsPage from '$pages/o/s/universe/data/integrations/UniverseIntegrationsPage.svelte';
	import { invalidateAll } from '$app/navigation';

	const { data } = $props();

	async function onToggle(id: string, enabled: boolean) {
		const res = await fetch('integrations/api', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id, enabled })
		});
		if (!res.ok) {
			const json = await res.json().catch(() => ({}));
			throw new Error((json as { message?: string }).message ?? 'Failed to update integration.');
		}
		await invalidateAll();
	}
</script>

<UniverseIntegrationsPage integrations={data.integrations} orgSlug={data.orgSlug} {onToggle} />
