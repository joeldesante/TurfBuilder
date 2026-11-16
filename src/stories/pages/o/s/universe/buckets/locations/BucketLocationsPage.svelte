<script lang="ts">
	import Pagination from '$components/data-display/pagination/Pagination.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Tabs from '$components/layout/tabs/Tabs.svelte';
	import MapView, {
		type MapBounds,
		type MapLayerData,
		type MapLocation
	} from '$components/data-display/map-view/MapView.svelte';
	import type { MapLayerSummary } from '$lib/shared/types/map-layers';
	import type { BucketMapCluster, BucketMapViewport } from '$lib/shared/types/bucket-map';
	import MapPinIcon from 'phosphor-svelte/lib/MapPin';

	export interface LocationRow {
		id: string;
		name: string | null;
		address_line_1: string | null;
		address_line_2: string | null;
		city: string | null;
		state_or_region: string | null;
		postal_code: string | null;
	}

	interface Props {
		bucketName: string;
		/** Whether the locations filter is enabled for this bucket. */
		enabled: boolean;
		/** One page of the matches, already ordered and sliced by the server. */
		locations: LocationRow[];
		/** Every match across all pages. Defaults to the rows given. */
		totalCount?: number;
		/** 1-based index of the page in `locations`. */
		page?: number;
		pageSize?: number;
		/** Base path for location detail links, e.g. /o/myorg/s/universe/buckets/my-bucket/locations */
		basePath?: string;
		/** The list, or every matched location on a map that fills the screen. */
		view?: 'list' | 'map';
		/** How many matches have a position, for the map view. */
		mapTotal?: number;
		/** The box around the matches with a position, where the map opens. */
		mapBounds?: MapBounds | null;
		/**
		 * Loads what the map draws for the area on screen: single points, or
		 * bubbles when the area holds too many to draw. Called each time the map
		 * settles, so only the shown part of the bucket is ever in the browser.
		 */
		onViewportLoad?: (bounds: MapBounds, zoom: number) => Promise<BucketMapViewport>;
		/** Fixed points for the map when there is no `onViewportLoad`, as in a story. */
		markers?: MapLocation[];
		/** The organization's map layers, which can be turned on and off on the map. */
		mapLayers?: MapLayerSummary[];
		/**
		 * Switches between list and map. When given, the tabs call it instead of
		 * being links, so the route can navigate behind the loading cover.
		 */
		onViewChange?: (view: 'list' | 'map') => void;
	}

	const {
		bucketName,
		enabled,
		locations,
		totalCount: totalCountProp,
		page = 1,
		pageSize = 100,
		basePath = '',
		view = 'list',
		mapTotal,
		mapBounds = null,
		onViewportLoad,
		markers = [],
		mapLayers = [],
		onViewChange
	}: Props = $props();

	const viewTabs = $derived([
		{ id: 'list', label: 'List', href: onViewChange ? undefined : basePath },
		{ id: 'map', label: 'Map', href: onViewChange ? undefined : `${basePath}?view=map` }
	]);
	const selectView = (id: string) => onViewChange?.(id === 'map' ? 'map' : 'list');

	const layers = $derived<MapLayerData[]>(
		mapLayers.map((l) => ({ id: l.id, name: l.name, color: l.color, labelField: l.label_field }))
	);

	const totalCount = $derived(totalCountProp ?? locations.length);

	let viewportPoints = $state<MapLocation[]>([]);
	let viewportClusters = $state<BucketMapCluster[]>([]);
	let viewportLoading = $state(false);
	// Only the latest request may draw: a slow answer for an area the person
	// already panned away from is dropped.
	let viewportRequest = 0;

	async function loadViewport(bounds: MapBounds, zoom: number) {
		if (!onViewportLoad) return;
		const request = ++viewportRequest;
		viewportLoading = true;
		try {
			const result = await onViewportLoad(bounds, zoom);
			if (request !== viewportRequest) return;
			viewportPoints = result.points;
			viewportClusters = result.clusters;
		} catch {
			// The route says so; the map keeps what it last drew.
		} finally {
			if (request === viewportRequest) viewportLoading = false;
		}
	}

	const mapPoints = $derived(onViewportLoad ? viewportPoints : markers);
	const mapCount = $derived(mapTotal ?? markers.length);

	function formatPrimary(row: LocationRow): string {
		if (row.name) return row.name;
		const parts = [row.address_line_1, row.address_line_2].filter(Boolean);
		return parts.join(', ') || 'Unknown Location';
	}

	function formatSecondary(row: LocationRow): string {
		const parts = [row.city, row.state_or_region, row.postal_code].filter(Boolean);
		return parts.join(', ');
	}
</script>

{#if enabled && view === 'map'}
	<!-- Fills the whole screen, over the staff sidebar, with the tabs floating on top to get back. -->
	<div class="fixed inset-0 z-50 bg-surface">
		<MapView
			locations={mapPoints}
			clusters={viewportClusters}
			markerStyle="dot"
			locationsLoading={viewportLoading}
			initialBounds={mapBounds}
			onViewportChange={onViewportLoad ? loadViewport : undefined}
			autoFit={!onViewportLoad}
			{layers}
			layerToggles
			class="h-full w-full"
		>
			{#snippet popup(loc)}
				<div class="flex min-w-48 flex-col gap-1 pr-6">
					<p class="font-semibold">{loc.name ?? loc.address_line_1 ?? 'Unknown Location'}</p>
					{#if loc.name && loc.address_line_1}
						<p class="text-xs text-on-surface-subtle">{[loc.address_line_1, loc.city].filter(Boolean).join(', ')}</p>
					{/if}
					<a href="{basePath}/{loc.id}" class="text-sm font-medium text-primary">Open</a>
				</div>
			{/snippet}
		</MapView>

		<div class="pointer-events-none absolute inset-x-0 top-2.5 z-20 flex justify-center px-16">
			<Tabs tabs={viewTabs} active="map" label="Location view" onSelect={selectView} class="pointer-events-auto rounded-full shadow-lg" />
		</div>

		<div class="pointer-events-none absolute top-2.5 left-2.5 z-20 hidden max-w-xs flex-col rounded-xl bg-surface/90 px-3 py-2 shadow-lg backdrop-blur md:flex">
			<span class="truncate text-sm font-semibold text-on-surface">{bucketName}</span>
			<span class="text-xs text-on-surface-subtle">
				{mapCount.toLocaleString()} {mapCount === 1 ? 'location' : 'locations'}
			</span>
		</div>
	</div>
{:else}
<div>
	<PageHeader title="Locations" subheading={bucketName}>
		{#snippet actions()}
			{#if enabled}
				<Tabs tabs={viewTabs} active="list" label="Location view" onSelect={selectView} />
			{/if}
		{/snippet}
	</PageHeader>

	{#if !enabled}
		<p class="text-on-surface-subtle mt-4">
			This bucket does not include a locations filter.
		</p>
	{:else if locations.length === 0}
		<p class="text-on-surface-subtle mt-4">
			No locations match the filters defined for this bucket.
		</p>
	{:else}
		<p class="text-sm text-on-surface-subtle my-4">
			{totalCount.toLocaleString()} {totalCount === 1 ? 'location' : 'locations'} matched
		</p>

		<div class="border-t border-outline-subtle">
			<Pagination {page} {totalCount} {pageSize} noun="locations" />
			<div class="flex items-center gap-4 px-4 py-2">
				<div class="w-8 shrink-0"></div>
				<span class="flex-1 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Location</span>
			</div>

			{#each locations as location (location.id)}
				<a
					href="{basePath}/{location.id}"
					class="flex items-center gap-4 px-4 py-3 border-b border-outline-subtle no-underline hover:bg-surface-container transition-colors duration-100 group"
				>
					<div class="w-8 h-8 shrink-0 flex items-center justify-center text-on-surface-subtle">
						<MapPinIcon size={20} />
					</div>
					<div class="flex-1 min-w-0">
						<span class="block text-sm text-on-surface truncate group-hover:text-primary transition-colors">
							{formatPrimary(location)}
						</span>
						{#if formatSecondary(location)}
							<span class="block text-xs text-on-surface-subtle truncate mt-0.5">
								{formatSecondary(location)}
							</span>
						{/if}
					</div>
				</a>
			{/each}
		</div>

		<Pagination {page} {totalCount} {pageSize} noun="locations" />
	{/if}
</div>
{/if}
