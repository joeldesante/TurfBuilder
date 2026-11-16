<script lang="ts">
	import { page } from '$app/stores';
	import { toast } from 'svelte-sonner';
	import BucketLocationsPage from '$pages/o/s/universe/buckets/locations/BucketLocationsPage.svelte';
	import { api, errorMessage } from '$lib/client/api';
	import { LOGO_AT_ONCE, navigateWithLoader } from '$lib/client/navigate-with-loader';
	import type { BucketMapViewport } from '$lib/shared/types/bucket-map';
	import type { MapBounds } from '$components/data-display/map-view/MapView.svelte';

	const { data } = $props();

	const basePath = `/o/${$page.params.org_slug}/s/universe/buckets/${$page.params.slug}/locations`;

	// The map asks for each area as it settles, so the browser only ever holds what is on screen.
	let viewportErrorShown = false;
	async function loadViewport(bounds: MapBounds, zoom: number): Promise<BucketMapViewport> {
		const params = new URLSearchParams({
			west: String(bounds.west),
			south: String(bounds.south),
			east: String(bounds.east),
			north: String(bounds.north),
			zoom: String(zoom)
		});
		try {
			return await api<BucketMapViewport>(`/buckets/${data.bucket.id}/location-map?${params}`);
		} catch (e) {
			// Once, not on every pan while the server is down.
			if (!viewportErrorShown) toast.error(errorMessage(e, 'The map could not load this area.'));
			viewportErrorShown = true;
			throw e;
		}
	}

	// Both views take a moment to load, so switching happens behind the TurfBuilder loading cover.
	async function changeView(view: 'list' | 'map') {
		try {
			await navigateWithLoader(view === 'map' ? `${basePath}?view=map` : basePath, {}, LOGO_AT_ONCE);
		} catch {
			toast.error('The page could not be loaded. Try again.');
		}
	}

</script>

<BucketLocationsPage
	bucketName={data.bucket.name}
	locations={data.locations}
	enabled={data.enabled}
	totalCount={data.totalCount}
	page={data.page}
	pageSize={data.pageSize}
	{basePath}
	view={data.view}
	mapTotal={data.map.total}
	mapBounds={data.map.bounds}
	onViewportLoad={loadViewport}
	mapLayers={data.mapLayers}
	onViewChange={changeView}
/>
