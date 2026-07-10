<script lang="ts" module>
	export interface MapLocation {
		id: string;
		name: string | null;
		address_line_1?: string | null;
		city?: string | null;
		latitude: number;
		longitude: number;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { mount, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import maplibregl from 'maplibre-gl';
	import { themeStore } from '$lib/theme.svelte';
	import { getMapStyle } from '$lib/map-style';
	import MapMarker from '$components/data-display/map-marker/MapMarker.svelte';
	import MapPopup from '$components/data-display/map-popup/MapPopup.svelte';
	import Spinner from '$components/feedback/spinner/Spinner.svelte';
	import SmileyIcon from 'phosphor-svelte/lib/Smiley';


	interface Props {
		locations?: MapLocation[];
		/** The id of the location currently selected on the map, or null. Bindable. */
		selectedLocationId?: string | null;
		/** Set while the parent is still fetching locations so the loading indicator reflects it. */
		locationsLoading?: boolean;
		/** Fallback center when there are no locations to fit. */
		defaultCenter?: [number, number];
		defaultZoom?: number;
		class?: string;
		/** Overlay content rendered above the map (buttons, legends, etc.). */
		children?: Snippet;
	}

	let {
		locations = [],
		selectedLocationId = $bindable(null),
		locationsLoading = false,
		defaultCenter = [-75.2238, 40.0259],
		defaultZoom = 12,
		class: className = '',
		children
	}: Props = $props();

	let mapContainer: HTMLDivElement;
	let map: maplibregl.Map | undefined;
	let markers: { id: string; marker: maplibregl.Marker }[] = [];
	let mapReady = $state(false);

	let mapLoading = $state(false);
	let mapLoadingComplete = $state(false);
	let tilesTotal = $state(0);
	let tilesLoaded = $state(0);

	function isDarkTheme() {
		return document.documentElement.getAttribute('data-theme') === 'dark';
	}

	function locationBounds(locs: MapLocation[]): maplibregl.LngLatBounds {
		return locs.reduce(
			(b, l) => b.extend([l.longitude, l.latitude]),
			new maplibregl.LngLatBounds(
				[locs[0].longitude, locs[0].latitude],
				[locs[0].longitude, locs[0].latitude]
			)
		);
	}

	function createMarker(loc: MapLocation) {
		const element = document.createElement('div');

		element.addEventListener('click', () => {
			selectedLocationId = loc.id;
		});

		mount(MapMarker, {
			target: element,
			props: {
				variant: 'unvisited',
				get isSelected() {
					return selectedLocationId === loc.id;
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
			.addTo(map!);

		markers.push({ id: loc.id, marker });
	}

	// Recreate markers whenever the location list changes.
	$effect(() => {
		const locs = locations;
		if (!mapReady || !map) return;

		markers.forEach(({ marker }) => marker.remove());
		markers = [];
		if (selectedLocationId && !locs.some((l) => l.id === selectedLocationId)) {
			selectedLocationId = null;
		}

		for (const loc of locs) {
			createMarker(loc);
		}

		if (locs.length > 0) {
			map.fitBounds(locationBounds(locs), { padding: 60, maxZoom: 16 });
		}
	});

	// Swap the base style when the site theme changes. Reading themeStore.theme
	// subscribes the effect; the resolved light/dark value comes from the DOM so
	// that 'system' follows the media query.
	$effect(() => {
		const dark = themeStore.theme === 'dark' || (themeStore.theme !== 'light' && isDarkTheme());
		if (map) {
			// @ts-expect-error getMapStyle returns a plain object rather than a StyleSpecification
			getMapStyle(dark).then((style) => map!.setStyle(style));
		}
	});

	/** Pans the map to a location, selects it, and opens its popup. */
	export function flyToLocation(id: string) {
		const loc = locations.find((l) => l.id === id);
		if (!loc || !map) return;

		markers.forEach(({ marker }) => {
			if (marker.getPopup()?.isOpen()) marker.togglePopup();
		});

		selectedLocationId = id;
		map.flyTo({ center: [loc.longitude, loc.latitude], zoom: 18 });

		const entry = markers.find((m) => m.id === id);
		if (entry) {
			map.once('moveend', () => entry.marker.togglePopup());
		}
	}

	onMount(() => {
		(async () => {
			const style = await getMapStyle(isDarkTheme());

			map = new maplibregl.Map({
				container: mapContainer,
				// @ts-expect-error getMapStyle returns a plain object rather than a StyleSpecification
				style,
				...(locations.length > 0
					? {
							bounds: locationBounds(locations),
							fitBoundsOptions: { padding: 60, maxZoom: 16 }
						}
					: { center: defaultCenter, zoom: defaultZoom }),
				attributionControl: { compact: true }
			});

			map.on('dataloading', () => {
				mapLoading = true;
				mapLoadingComplete = false;
				tilesTotal = 0;
				tilesLoaded = 0;
			});
			map.on('sourcedataloading', (e) => {
				if (e.tile) tilesTotal++;
			});
			map.on('sourcedata', (e) => {
				if (e.tile) tilesLoaded++;
			});
			map.on('idle', () => {
				mapLoading = false;
				mapLoadingComplete = true;
			});

			map.on('load', () => {
				mapReady = true;
			});
		})();

		return () => {
			map?.remove();
			map = undefined;
		};
	});
</script>

<!-- The container pair is positioned with inline styles because maplibre's own
     stylesheet sets .maplibregl-map to position: relative, which overrides a
     Tailwind class of equal specificity and collapses the map to zero height. -->
<div class={className} style="position: relative;">
	<div
		bind:this={mapContainer}
		style="position: absolute; inset: 0;"
		data-testid="locations-map"
	></div>

	{#if mapLoading || mapLoadingComplete || locationsLoading}
		<div class="absolute bottom-3 left-3 flex flex-col items-start gap-1 z-20 pointer-events-none">
			<progress
				value={mapLoadingComplete && !locationsLoading ? 1 : tilesLoaded}
				max={mapLoadingComplete && !locationsLoading ? 1 : tilesTotal || 1}
				class:complete={mapLoadingComplete && !locationsLoading}
			></progress>
			<span class="relative flex h-4">
				{#if mapLoading || locationsLoading}
					<span class="indicator-content" out:fade={{ duration: 300 }}>
						<Spinner size={12} />
						<span class="loading-label">
							{#if mapLoading && locationsLoading}
								Loading map and locations...
							{:else if mapLoading}
								Loading map tiles...
							{:else}
								Loading locations...
							{/if}
						</span>
					</span>
				{:else}
					<span class="indicator-content" in:fade={{ duration: 300, delay: 150 }}>
						<SmileyIcon weight="fill" size={12} />
						{locations.length} location{locations.length === 1 ? '' : 's'} loaded
					</span>
				{/if}
			</span>
		</div>
	{/if}

	{#if children}
		{@render children()}
	{/if}
</div>

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

	:global(.maplibregl-popup-anchor-bottom .maplibregl-popup-tip) {
		border-top-color: var(--surface);
	}
	:global(.maplibregl-popup-anchor-top .maplibregl-popup-tip) {
		border-bottom-color: var(--surface);
	}
	:global(.maplibregl-popup-anchor-left .maplibregl-popup-tip) {
		border-right-color: var(--surface);
	}
	:global(.maplibregl-popup-anchor-right .maplibregl-popup-tip) {
		border-left-color: var(--surface);
	}
	:global(.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip),
	:global(.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip) {
		border-top-color: var(--surface);
	}
	:global(.maplibregl-popup-anchor-top-left .maplibregl-popup-tip),
	:global(.maplibregl-popup-anchor-top-right .maplibregl-popup-tip) {
		border-bottom-color: var(--surface);
	}

	progress {
		display: block;
		width: 200px;
		height: 5px;
		border-radius: 3px;
		border: none;
		overflow: hidden;
		appearance: none;
		background-color: rgb(0 0 0 / 0.15);
	}

	progress::-webkit-progress-bar {
		background-color: rgb(0 0 0 / 0.15);
		border-radius: 3px;
	}
	progress::-webkit-progress-value {
		background-color: var(--primary);
		border-radius: 3px;
	}
	progress::-moz-progress-bar {
		background-color: var(--primary);
		border-radius: 3px;
	}
	progress.complete::-webkit-progress-value {
		background-color: rgb(0 0 0 / 0.25);
	}
	progress.complete::-moz-progress-bar {
		background-color: rgb(0 0 0 / 0.25);
	}

	:global([data-theme='dark']) progress {
		background-color: rgb(255 255 255 / 0.2);
	}
	:global([data-theme='dark']) progress::-webkit-progress-bar {
		background-color: rgb(255 255 255 / 0.2);
	}
	:global([data-theme='dark']) progress.complete::-webkit-progress-value {
		background-color: rgb(255 255 255 / 0.3);
	}
	:global([data-theme='dark']) progress.complete::-moz-progress-bar {
		background-color: rgb(255 255 255 / 0.3);
	}

	.indicator-content {
		position: absolute;
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 4px;
		font-size: 0.625rem;
		color: rgb(0 0 0 / 0.45);
		letter-spacing: 0.01em;
		white-space: nowrap;
	}

	:global([data-theme='dark']) .indicator-content {
		color: rgb(255 255 255 / 0.55);
	}

	.loading-label {
		background: linear-gradient(
			90deg,
			rgb(0 0 0 / 0.25),
			rgb(0 0 0 / 0.55),
			rgb(0 0 0 / 0.35),
			rgb(0 0 0 / 0.6),
			rgb(0 0 0 / 0.2),
			rgb(0 0 0 / 0.55),
			rgb(0 0 0 / 0.25)
		);
		background-size: 300%;
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		animation: shimmer-sweep 8s linear infinite;
	}

	:global([data-theme='dark']) .loading-label {
		background: linear-gradient(
			90deg,
			rgb(255 255 255 / 0.25),
			rgb(255 255 255 / 0.65),
			rgb(255 255 255 / 0.35),
			rgb(255 255 255 / 0.7),
			rgb(255 255 255 / 0.2),
			rgb(255 255 255 / 0.65),
			rgb(255 255 255 / 0.25)
		);
		background-size: 300%;
		-webkit-background-clip: text;
		background-clip: text;
	}

	@keyframes shimmer-sweep {
		from {
			background-position: 0%;
		}
		to {
			background-position: 300%;
		}
	}
</style>
