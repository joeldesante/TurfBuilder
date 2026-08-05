<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import TurfMapPage from '$pages/o/map/TurfMapPage.svelte';
	import type { LocationFields, LocationEditProposal } from '$lib/schemas/location';

	const { data, params } = $props();

	const base = $derived(`/o/${params.org_slug}/map/${data.turfId}/locations`);

	/** Throws the server's message so the form surfaces it verbatim. */
	async function send(url: string, method: string, body?: unknown) {
		const res = await fetch(url, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
		if (!res.ok) {
			const { error } = await res.json().catch(() => ({ error: 'Request failed.' }));
			throw new Error(error);
		}
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
		await send(`${base}/${turfLocationId}/edits`, 'POST', proposal);
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
