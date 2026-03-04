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

	let selectedLocationId = $state<number | null>(null);
	let selectedLocation = $state<Location | null>(null);
	let showPanel = $state(false);

	// Geolocation state
	type GeolocateState = 'idle' | 'locating' | 'tracking' | 'error';
	let geolocateState = $state<GeolocateState>('idle');
	let watchId = $state<number | null>(null);

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
		<div class="panel flex flex-col gap-2">
			<div class="flex justify-between items-start">
				<h3>{selectedLocation?.location_name}</h3>
				<button
					class="cursor-pointer"
					aria-label="close"
					onclick={() => {
						closePanel();
					}}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="size-6"
					>
						<path
							fill-rule="evenodd"
							d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			</div>
			<div>
				<p class="font-medium">{selectedLocation?.street}</p>
				<p class="text-sm">
					{selectedLocation?.locality}, {selectedLocation?.region}
					{selectedLocation?.postcode}
				</p>
			</div>
			<div class="flex justify-end flex-col flex-1 mt-4">
				<a
					href="/map/{data.turfId.toString()}/location/{selectedLocation?.id}"
					class="cursor-pointer bg-blue-500 px-3 py-2 rounded-full font-bold text-white block text-center"
					>Open Location</a
				>
			</div>
		</div>
	{/if}
	<div bind:this={mapContainer} class="map-container"></div>
</div>

<style>
	.map-container {
		width: 100vw;
		height: 100vh;
	}

	.panel {
		position: absolute;
		width: calc(100vw - 20px);
		height: auto;
		z-index: 100000;
		bottom: 10px;
		left: 10px;
		background-color: var(--color-surface);
		border-radius: 5px;
		box-shadow: 0px 0px 5px rgba(0, 0, 0, 0.15);
		padding: 15px;
	}

	.panel h3 {
		font-size: 1.2rem;
		font-weight: 600;
	}
</style>
