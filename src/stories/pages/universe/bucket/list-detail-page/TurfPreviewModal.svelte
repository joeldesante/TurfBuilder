<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { mount, onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import { getMapStyle } from '$lib/map-style';
	import MapMarker from '$components/data-display/map-marker/MapMarker.svelte';
	import MapPopup from '$components/data-display/map-popup/MapPopup.svelte';
	import XIcon from 'phosphor-svelte/lib/X';
	import MapPinIcon from 'phosphor-svelte/lib/MapPin';
	import SpinnerGap from 'phosphor-svelte/lib/SpinnerGap';
	import CopyButton from '$components/actions/copy-button/CopyButton.svelte';
	import 'maplibre-gl/dist/maplibre-gl.css';

	interface LocationPreview {
		id: string;
		name: string | null;
		address_line_1: string | null;
		city: string | null;
		state_or_region: string | null;
		latitude: number;
		longitude: number;
	}

	interface Props {
		turfId: string;
		turfCode: string;
		orgSlug: string;
		open: boolean;
		onClose: () => void;
	}

	const { turfId, turfCode, orgSlug, open, onClose }: Props = $props();

	let mapContainer: HTMLDivElement | undefined = $state();
	let map: maplibregl.Map | undefined;
	let markers: { id: string; marker: maplibregl.Marker }[] = [];

	let loading = $state(false);
	let error = $state<string | null>(null);
	let locations = $state<LocationPreview[]>([]);
	let selectedId = $state<string | null>(null);

	function isDarkTheme() {
		return document.documentElement.getAttribute('data-theme') === 'dark';
	}

	function locationLabel(loc: LocationPreview): string {
		return loc.name ?? loc.address_line_1 ?? 'Unknown';
	}

	function clearMap() {
		markers.forEach(({ marker }) => marker.remove());
		markers = [];
		if (map) {
			map.remove();
			map = undefined;
		}
	}

	function computeInitialBounds(bounds: string | null, locs: LocationPreview[]): maplibregl.LngLatBounds | null {
		if (bounds) {
			try {
				const geometry = JSON.parse(bounds);
				const coords: [number, number][] =
					geometry.type === 'MultiPolygon'
						? geometry.coordinates.flatMap((poly: [number, number][][]) => poly[0])
						: geometry.coordinates[0];
				if (coords.length > 0) {
					return coords.reduce(
						(b, c) => b.extend(c),
						new maplibregl.LngLatBounds(coords[0], coords[0])
					);
				}
			} catch {
				// fall through to locations
			}
		}
		if (locs.length > 0) {
			return locs.reduce(
				(b, l) => b.extend([l.longitude, l.latitude] as [number, number]),
				new maplibregl.LngLatBounds(
					[locs[0].longitude, locs[0].latitude],
					[locs[0].longitude, locs[0].latitude]
				)
			);
		}
		return null;
	}

	async function initMap(bounds: string | null, locs: LocationPreview[]) {
		if (!mapContainer) return;

		const initialBounds = computeInitialBounds(bounds, locs);
		const style = await getMapStyle(isDarkTheme());
		map = new maplibregl.Map({
			container: mapContainer,
			// @ts-ignore — getMapStyle returns Record<string,unknown> which satisfies the runtime contract
			style,
			...(initialBounds
				? { bounds: initialBounds, fitBoundsOptions: { padding: 60, maxZoom: 16 } }
				: { center: [0, 0] as [number, number], zoom: 12 })
		});

		map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

		map.on('load', () => {
			if (!map) return;

			// Add turf polygon
			if (bounds) {
				try {
					const geometry = JSON.parse(bounds);
					map.addSource('turf-bounds', {
						type: 'geojson',
						data: { type: 'Feature', geometry, properties: {} }
					});
					map.addLayer({
						id: 'turf-fill',
						type: 'fill',
						source: 'turf-bounds',
						paint: { 'fill-color': '#10b981', 'fill-opacity': 0.18 }
					});
					map.addLayer({
						id: 'turf-outline',
						type: 'line',
						source: 'turf-bounds',
						paint: { 'line-color': '#10b981', 'line-width': 2.5, 'line-opacity': 0.9 }
					});
				} catch {
					// malformed bounds geometry; polygon layer skipped
				}
			}

			// Add location markers
			for (const loc of locs) {
				const element = document.createElement('div');
				element.addEventListener('click', () => {
					selectedId = loc.id;
				});
				mount(MapMarker, {
					target: element,
					props: {
						variant: 'unvisited',
						get isSelected() {
							return selectedId === loc.id;
						}
					}
				});

				const popupEl = document.createElement('div');
				mount(MapPopup, {
					target: popupEl,
					props: {
						locationName: loc.name ?? loc.address_line_1 ?? '',
						street: loc.address_line_1,
						locality: loc.city
					}
				});

				const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
					.setLngLat([loc.longitude, loc.latitude])
					.setPopup(new maplibregl.Popup({ offset: 34 }).setDOMContent(popupEl))
					.addTo(map);

				markers.push({ id: loc.id, marker });
			}
		});
	}

	async function load() {
		loading = true;
		error = null;
		try {
			const res = await fetch(`/o/${orgSlug}/s/api/turfs/${turfId}/preview`);
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				error = body.error ?? `Failed to load turf (${res.status})`;
				return;
			}
			const data: { turf: { bounds: string | null }; locations: LocationPreview[] } = await res.json();
			locations = data.locations;
			// Wait a tick for the map container to be in the DOM
			await Promise.resolve();
			await initMap(data.turf.bounds, data.locations);
		} catch {
			error = 'Failed to load turf preview.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (open) {
			load();
		} else {
			clearMap();
			locations = [];
			selectedId = null;
			error = null;
		}
	});

	onDestroy(() => {
		clearMap();
	});

	function flyToLocation(loc: LocationPreview) {
		if (!map) return;
		markers.forEach(({ marker }) => {
			if (marker.getPopup()?.isOpen()) marker.togglePopup();
		});
		selectedId = loc.id;
		map.flyTo({ center: [loc.longitude, loc.latitude], zoom: 17 });
		const entry = markers.find((m) => m.id === loc.id);
		if (entry) {
			map.once('moveend', () => entry.marker.togglePopup());
		}
	}
</script>

<Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/50" />
		<Dialog.Content
			class="fixed inset-4 z-50 flex flex-col rounded-xl bg-surface border border-outline-subtle shadow-xl overflow-hidden md:inset-8"
			aria-label="Turf {turfCode} preview"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-4 py-3 border-b border-outline-subtle shrink-0">
				<div class="flex items-center gap-2">
					<MapPinIcon class="size-4 text-on-surface-subtle" />
					<span class="text-sm font-semibold text-on-surface font-mono">{turfCode}</span>
					<CopyButton value={turfCode} aria-label="Copy turf code" />
					{#if locations.length > 0}
						<span class="text-xs text-on-surface-subtle">{locations.length} location{locations.length === 1 ? '' : 's'}</span>
					{/if}
				</div>
				<button
					onclick={onClose}
					class="rounded-md p-1.5 text-on-surface-subtle hover:bg-surface-container hover:text-on-surface transition-colors"
					aria-label="Close preview"
				>
					<XIcon class="size-4" />
				</button>
			</div>

			<!-- Body: sidebar + map -->
			<div class="flex flex-1 min-h-0">
				<!-- Sidebar -->
				<div class="w-72 shrink-0 flex flex-col border-r border-outline-subtle">
					<div class="px-4 py-2 border-b border-outline-subtle">
						<span class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Locations</span>
					</div>
					<div class="flex-1 overflow-y-auto">
						{#if loading}
							<div class="flex items-center justify-center py-12 text-on-surface-subtle">
								<SpinnerGap class="size-5 animate-spin" />
							</div>
						{:else if error}
							<p class="px-4 py-6 text-sm text-error text-center">{error}</p>
						{:else if locations.length === 0}
							<p class="px-4 py-8 text-sm text-on-surface-subtle text-center">No locations in this turf.</p>
						{:else}
							{#each locations as loc (loc.id)}
								<button
									onclick={() => flyToLocation(loc)}
									class="w-full text-left flex flex-col gap-0.5 px-4 py-3 border-b border-outline-subtle transition-colors hover:bg-surface-container {selectedId === loc.id ? 'bg-surface-container' : ''}"
								>
									<span class="text-sm font-medium text-on-surface truncate">{locationLabel(loc)}</span>
									{#if loc.address_line_1 && loc.name}
										<span class="text-xs text-on-surface-subtle truncate">{loc.address_line_1}</span>
									{/if}
									{#if loc.city}
										<span class="text-xs text-on-surface-subtle">{loc.city}{loc.state_or_region ? `, ${loc.state_or_region}` : ''}</span>
									{/if}
								</button>
							{/each}
						{/if}
					</div>
				</div>

				<!-- Map -->
				<div class="flex-1 relative">
					{#if loading}
						<div class="absolute inset-0 flex items-center justify-center bg-surface text-on-surface-subtle z-10">
							<SpinnerGap class="size-8 animate-spin" />
						</div>
					{/if}
					<div bind:this={mapContainer} class="w-full h-full"></div>
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.maplibregl-popup) {
		font-family: inherit;
	}

	:global(.maplibregl-popup-content) {
		background-color: var(--surface);
		color: var(--on-surface);
		border-radius: 0.75rem;
		box-shadow:
			0 10px 15px -3px rgb(0 0 0 / 0.1),
			0 4px 6px -4px rgb(0 0 0 / 0.1);
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		border: 1px solid var(--outline-subtle);
	}

	:global(.maplibregl-popup-close-button) {
		color: var(--on-surface-subtle);
		font-size: 0;
		aspect-ratio: 1;
		padding: 0;
		width: 2rem;
		border-radius: 0.375rem;
		margin: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	:global(.maplibregl-popup-close-button::after) {
		content: '';
		display: block;
		width: 0.75rem;
		height: 0.75rem;
		background-color: currentColor;
		mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath d='M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z'/%3E%3C/svg%3E");
		mask-size: contain;
		mask-repeat: no-repeat;
		mask-position: center;
	}

	:global(.maplibregl-popup-close-button:focus:not(:focus-visible)) {
		outline: none;
	}

	:global(.maplibregl-popup-close-button:hover) {
		background-color: var(--surface-container);
		color: var(--on-surface);
	}

	:global(.maplibregl-popup-anchor-bottom .maplibregl-popup-tip) { border-top-color: var(--surface); }
	:global(.maplibregl-popup-anchor-top .maplibregl-popup-tip) { border-bottom-color: var(--surface); }
	:global(.maplibregl-popup-anchor-left .maplibregl-popup-tip) { border-right-color: var(--surface); }
	:global(.maplibregl-popup-anchor-right .maplibregl-popup-tip) { border-left-color: var(--surface); }
	:global(.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip),
	:global(.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip) { border-top-color: var(--surface); }
	:global(.maplibregl-popup-anchor-top-left .maplibregl-popup-tip),
	:global(.maplibregl-popup-anchor-top-right .maplibregl-popup-tip) { border-bottom-color: var(--surface); }
</style>
