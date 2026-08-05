<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import UniverseDataLocationsPage from '$pages/o/s/universe/data/locations/UniverseDataLocationsPage.svelte';
	import type { LocationFields } from '$lib/schemas/location';

	const { data } = $props();

	const base = $derived(`/o/${data.organization.slug}/s/api/universe/locations`);

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

	async function handleCreate(fields: LocationFields) {
		await send(base, 'POST', fields);
	}

	async function handleUpdate(entityId: string, fields: LocationFields) {
		await send(`${base}/${entityId}`, 'PATCH', fields);
	}

	async function handleDelete(entityId: string) {
		await send(`${base}/${entityId}`, 'DELETE');
	}
</script>

<UniverseDataLocationsPage
	orgSlug={data.organization.slug}
	totalCount={data.totalCount}
	locations={data.locations}
	canCreate={data.canCreate}
	canUpdate={data.canUpdate}
	canDelete={data.canDelete}
	onCreate={handleCreate}
	onUpdate={handleUpdate}
	onDelete={handleDelete}
/>
