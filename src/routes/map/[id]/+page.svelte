<script lang="ts">
	type Location = {
		id: number;
		location_name: string;
		category: string | null;
		latitude: number;
		longitude: number;
		street: string | null;
		locality: string | null;
		postcode: string | null;
		region: string | null;
		country: string | null;
	};

	import { mount, onMount } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeft';
	import GpsIcon from 'phosphor-svelte/lib/Gps';
	import MapMarker, {
		type Variant
	} from '../../../stories/components/data-display/map-marker/MapMarker.svelte';
	import Badge from '../../../stories/components/data-display/badge/Badge.svelte';
	import Button from '../../../stories/components/actions/button/Button.svelte';
	import XIcon from 'phosphor-svelte/lib/XIcon';

	function categoryToVariant(category: string | null): Variant {
		switch (category) {
			case 'contacted':
				return 'contacted';
			case 'no-contact':
				return 'no-contact';
			case 'hostile':
				return 'hostile';
			default:
				return 'unvisited';
		}
	}

	const variantBadgeProps: Record<
		Variant,
		{
			label: string;
			variant:
				| 'location-unvisited'
				| 'location-contacted'
				| 'location-no-contact'
				| 'location-hostile';
		}
	> = {
		unvisited: { label: 'Unvisited', variant: 'location-unvisited' },
		contacted: { label: 'Contacted', variant: 'location-contacted' },
		'no-contact': { label: 'No Contact', variant: 'location-no-contact' },
		hostile: { label: 'Hostile', variant: 'location-hostile' }
	};

	let selectedLocationId = $state<number | null>(null);
	let selectedLocation = $state<Location | null>(null);
	let showPanel = $state(false);

	// Geolocation state
	type GeolocateState = 'idle' | 'locating' | 'tracking' | 'error';
	let geolocateState = $state<GeolocateState>('idle');
	let watchId = $state<number | null>(null);
	let selectedVariant = $derived(categoryToVariant(selectedLocation?.category ?? null));
	let badgeProps = $derived(variantBadgeProps[selectedVariant]);

	let { data } = $props();

	let mapContainer: HTMLDivElement;
	const DEFAULT_ZOOM = 18;

	let map: maplibregl.Map;
	let locations: Location[] = [];
	let markers: maplibregl.Marker[] = [];

	function stopTracking() {
		if (watchId !== null) {
			navigator.geolocation.clearWatch(watchId);
			watchId = null;
		}
		geolocateState = 'idle';
	}

	function toggleGeolocate() {
		if (geolocateState === 'tracking' || geolocateState === 'locating') {
			stopTracking();
			return;
		}

		if (!navigator.geolocation) {
			geolocateState = 'error';
			return;
		}

		geolocateState = 'locating';

		watchId = navigator.geolocation.watchPosition(
			(position) => {
				geolocateState = 'tracking';
				map.flyTo({
					center: [position.coords.longitude, position.coords.latitude],
					zoom: DEFAULT_ZOOM
				});
			},
			() => {
				geolocateState = 'error';
				watchId = null;
			},
			{ enableHighAccuracy: true }
		);
	}

	async function fetchLocations(bounds: maplibregl.LngLatBounds) {
		locations = data.locations;

		if (markers) {
			//@ts-ignore
			markers.forEach((m) => m.marker.remove());
		}
		markers = [];

		locations.forEach((location: Location) => {
			const markerDomElement = document.createElement('div');

			let state = $state({
				isSelected: selectedLocationId === location.id
			});

			markerDomElement.addEventListener('click', () => {
				markers.forEach((m) => {
					//@ts-ignore
					m.state.isSelected = false;
				});

				state.isSelected = true;
				selectedLocationId = location.id;
				selectedLocation = location;
				showPanel = true;
			});

			const markerInstance = mount(MapMarker, {
				target: markerDomElement,
				props: {
					get isSelected() {
						return state.isSelected;
					},
					variant: categoryToVariant(location.category)
				}
			});

			const marker = new maplibregl.Marker({ element: markerDomElement })
				.setLngLat([location.longitude, location.latitude])
				.addTo(map);

			//@ts-ignore
			markers.push({ marker, state });
		});
	}

	function closePanel() {
		showPanel = false;
		selectedLocation = null;
		selectedLocationId = null;

		markers.forEach((m) => {
			//@ts-ignore
			m.state.isSelected = false;
		});
	}

	onMount(() => {
		console.log(data.center.longitude, data.center.latitude);

		map = new maplibregl.Map({
			container: mapContainer,
			style: 'https://tiles.openfreemap.org/styles/positron',
			center: [data.center.lng, data.center.lat],
			zoom: DEFAULT_ZOOM
		});

		// Add geolocate control to track user position
		const geolocateControl = new maplibregl.GeolocateControl({
			positionOptions: {
				enableHighAccuracy: true
			},
			trackUserLocation: true,
			showUserLocation: true,
			showAccuracyCircle: true,
			fitBoundsOptions: {
				zoom: DEFAULT_ZOOM
			}
		});

		map.addControl(geolocateControl);

		map.on('load', () => {
			fetchLocations(map.getBounds());
		});

		map.on('moveend', () => {
			fetchLocations(map.getBounds());
		});

		return () => {
			stopTracking();
			map.remove();
		};
	});
</script>

<!-- Back button -->
<a
	href="/"
	class="fixed top-4 left-4 z-20 size-10 rounded-full bg-surface text-on-surface inline-flex items-center justify-center shadow"
	aria-label="Back to home"
>
	<ArrowLeftIcon size={20} weight="bold" />
</a>

<!-- Custom geolocate button — sits below the avatar (top-4 + size-10 + gap-3 = top-[68px]) -->
<button
	onclick={toggleGeolocate}
	aria-label={geolocateState === 'tracking' ? 'Stop tracking location' : 'Find my location'}
	class={[
		'fixed top-[68px] right-4 z-20 size-10 rounded-full inline-flex items-center justify-center shadow transition-colors',
		geolocateState === 'tracking'
			? 'bg-success-container text-on-success-container'
			: geolocateState === 'error'
				? 'bg-error-container text-on-error-container'
				: 'bg-surface text-on-surface'
	].join(' ')}
>
	<GpsIcon size={20} weight={geolocateState === 'tracking' ? 'fill' : 'bold'} />
</button>

<div>
	{#if showPanel}
		<div
			class="flex flex-col gap-5 rounded-xl absolute bottom-3 left-3 right-3 bg-surface p-4 shadow-lg z-10"
		>
			<Button
				variant="ghost"
				iconOnly
				aria-label="close"
				class="absolute top-1 right-1"
				onclick={() => closePanel()}
			>
				<XIcon />
			</Button>
			<div class="self-start">
				<Badge variant={badgeProps.variant} size="sm">{badgeProps.label}</Badge>
			</div>
			<div class="space-y-1 mb-6">
				<h3 class="text-lg font-semibold">{selectedLocation?.location_name}</h3>
				{#if selectedLocation?.street}
					<p class="text-on-surface-variant text-sm">{selectedLocation.street}</p>
				{/if}
			</div>

			<Button
				href="/map/{data.turfId.toString()}/location/{selectedLocation?.id}"
				variant="primary"
				class="w-full"
			>
				Open Location
			</Button>
		</div>
	{/if}
	<div bind:this={mapContainer} class="map-container"></div>
</div>

<style>
	.map-container {
		width: 100vw;
		height: 100vh;
	}

	/* Restore MapLibre user location dot — Tailwind preflight resets border-width: 0
	   on ::after which breaks the white ring, and background-color can be reset too */
	:global(.maplibregl-user-location-dot),
	:global(.maplibregl-user-location-dot::before) {
		background-color: #1da1f2;
		border-radius: 50%;
		height: 15px;
		width: 15px;
	}

	:global(.maplibregl-user-location-dot::before) {
		animation: maplibregl-user-location-dot-pulse 2s infinite;
		content: '';
		position: absolute;
	}

	:global(.maplibregl-user-location-dot::after) {
		border: 2px solid #fff;
		border-radius: 50%;
		box-shadow: 0 0 3px rgba(0, 0, 0, 0.35);
		box-sizing: border-box;
		content: '';
		height: 19px;
		left: -2px;
		position: absolute;
		top: -2px;
		width: 19px;
	}

	:global(.maplibregl-user-location-accuracy-circle) {
		background-color: rgba(29, 161, 242, 0.2);
		border-radius: 100%;
		height: 1px;
		width: 1px;
	}
</style>
