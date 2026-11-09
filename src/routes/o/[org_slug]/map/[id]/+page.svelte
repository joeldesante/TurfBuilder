<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import TurfMapPage from '$pages/o/map/TurfMapPage.svelte';
	import type { LocationFields, LocationEditProposal } from '$lib/schemas/location';
	import { api } from '$lib/client/api';

	const { data, params } = $props();

	const base = $derived(`/turfs/${data.turfId}/locations`);

	/** Throws ApiError with the server's message, which the form shows as is. */
	async function send(path: string, method: string, body?: unknown) {
		await api(path, { method, body });
		await invalidateAll();
	}

	async function handleSuggest(fields: LocationFields) {
		await send(base, 'POST', fields);
	}

	async function handleEditSuggestion(entityId: string, fields: LocationFields) {
		await send(`${base}/${entityId}`, 'PATCH', fields);
	}

	async function handleDeleteSuggestion(entityId: string) {
		await send(`${base}/${entityId}`, 'DELETE');
	}

	async function handleProposeEdit(turfLocationId: string, proposal: LocationEditProposal) {
		await send(`/doors/${turfLocationId}/edits`, 'POST', proposal);
	}
</script>

<TurfMapPage
	orgSlug={params.org_slug}
	turfId={data.turfId}
	locations={data.locations}
	center={data.center}
	bounds={data.bounds}
	canSuggest={data.canSuggest}
	onSuggest={handleSuggest}
	onEditSuggestion={handleEditSuggestion}
	onDeleteSuggestion={handleDeleteSuggestion}
	onProposeEdit={handleProposeEdit}
/>
