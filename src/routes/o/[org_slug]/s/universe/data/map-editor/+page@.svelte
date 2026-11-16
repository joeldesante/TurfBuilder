<script lang="ts">
	import MapEditorPage from '$pages/o/s/universe/data/map-editor/MapEditorPage.svelte';
	import { api } from '$lib/client/api';
	import type { MapLayerSummary } from '$lib/shared/types/map-layers';

	const { data } = $props();

	const orgId = $derived(data.organization.id);
</script>

<MapEditorPage
	layers={data.layers}
	dashboardHref={`/o/${data.organization.slug}/s/`}
	onCreate={(input) =>
		api<MapLayerSummary>(`/organizations/${orgId}/map-layers`, { method: 'POST', body: input })}
	onUpdate={(id, changes) => api<MapLayerSummary>(`/map-layers/${id}`, { method: 'PATCH', body: changes })}
	onDelete={(id) => api<void>(`/map-layers/${id}`, { method: 'DELETE' })}
	onReorder={(ids) =>
		api<void>(`/organizations/${orgId}/map-layer-order`, { method: 'PUT', body: { ids } })}
/>
