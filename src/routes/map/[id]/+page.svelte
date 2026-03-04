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
		{ label: string; variant: 'default' | 'success' | 'warning' | 'error' }
	> = {
		unvisited: { label: 'Unvisited', variant: 'default' },
		contacted: { label: 'Contacted', variant: 'success' },
		'no-contact': { label: 'No Contact', variant: 'warning' },
		hostile: { label: 'Hostile', variant: 'error' }
	};

	let selectedLocationId = $state<number | null>(null);
	let selectedLocation = $state<Location | null>(null);
	let showPanel = $state(false);

	let selectedVariant = $derived(categoryToVariant(selectedLocation?.category ?? null));
	let badgeProps = $derived(variantBadgeProps[selectedVariant]);

	let { data } = $props();

	let mapContainer: HTMLDivElement;
	const DEFAULT_ZOOM = 18;

	let map: maplibregl.Map;
	let locations: Location[] = [];
	let markers: maplibregl.Marker[] = [];

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
			trackUserLocation: true, // Keep tracking as user moves
			showAccuracyCircle: true,
			fitBoundsOptions: {
				zoom: DEFAULT_ZOOM
			}
		});

		map.addControl(geolocateControl);

		map.on('load', () => {
			//geolocateControl.trigger();
			fetchLocations(map.getBounds());
		});

		// Fetch locations whenever map moves
		map.on('moveend', () => {
			fetchLocations(map.getBounds());
		});

		return () => {
			map.remove();
		};
	});
</script>

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
</style>
