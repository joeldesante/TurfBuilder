<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import UniverseDataLocationsPage from '$pages/o/s/universe/data/locations/UniverseDataLocationsPage.svelte';
	import type { MapBounds } from '$components/data-display/locations-map/LocationsMap.svelte';
	import type { ViewportResult } from '$pages/o/s/universe/data/locations/UniverseDataLocationsPage.svelte';
	import type { LocationFields } from '$lib/schemas/location';
	import { api } from '$lib/client/api';

	const { data } = $props();

	const org = $derived(`/organizations/${data.organization.id}`);

	/** Throws ApiError with the server's message, which the form shows as is. */
	async function send(path: string, method: string, body?: unknown) {
		await api(path, { method, body });
		await invalidateAll();
	}

	async function handleCreate(fields: LocationFields) {
		await send(`${org}/locations`, 'POST', fields);
	}

	async function handleUpdate(entityId: string, fields: LocationFields) {
		await send(`/locations/${entityId}`, 'PATCH', fields);
	}

	async function handleDelete(entityId: string) {
		await send(`/locations/${entityId}`, 'DELETE');
	}

	/**
	 * Locations for the area the map is showing. Separate from the page load,
	 * which returns one alphabetical page and so cannot say what is on screen.
	 */
	async function handleViewportLoad(bounds: MapBounds) {
		const query = new URLSearchParams({
			west: String(bounds.west),
			south: String(bounds.south),
			east: String(bounds.east),
			north: String(bounds.north)
		});
		return api<ViewportResult>(`${org}/location-markers?${query}`);
	}
</script>

<UniverseDataLocationsPage
	orgSlug={data.organization.slug}
	totalCount={data.totalCount}
	page={data.page}
	pageSize={data.pageSize}
	locations={data.locations}
	initialBounds={data.initialBounds}
	onViewportLoad={handleViewportLoad}
	canCreate={data.canCreate}
	canUpdate={data.canUpdate}
	canDelete={data.canDelete}
	onCreate={handleCreate}
	onUpdate={handleUpdate}
	onDelete={handleDelete}
/>
