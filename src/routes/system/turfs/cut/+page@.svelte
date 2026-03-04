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

	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import maplibregl from 'maplibre-gl';
	import Button from '$components/actions/button/Button.svelte';

	import 'maplibre-gl/dist/maplibre-gl.css';
	import '@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css';
	import type {
		FeatureData,
		FeatureId,
		FeatureStore,
		Geoman
	} from '@geoman-io/maplibre-geoman-free';

	let mapContainer: HTMLDivElement;
	const DEFAULT_ZOOM = 18;

	let map: maplibregl.Map;
	let locations: Location[] = [];
	let markers: maplibregl.Marker[] = [];
	let geoman: Geoman | undefined;

	let saving = $state(false);
	let saved = $state(false);

	async function fetchLocations(bounds: maplibregl.LngLatBounds) {
		const response = await fetch(
			`/api/locations?` +
				`lat_min=${bounds.getSouth()}&lat_max=${bounds.getNorth()}` +
				`&lon_min=${bounds.getWest()}&lon_max=${bounds.getEast()}`
		);
		locations = await response.json();

		// Remove old markers first if you keep them in an array
		if (markers) {
			markers.forEach((m: maplibregl.Marker) => m.remove());
		}
		markers = [];

		// Add new markers
		locations.forEach((loc: Location) => {
			const marker = new maplibregl.Marker()
				.setLngLat([loc.longitude, loc.latitude])
				.setPopup(new maplibregl.Popup().setText(loc.location_name))
				.addTo(map);

			markers.push(marker);
		});
	}

	async function saveTurfs() {
		if (!geoman || saving) return;

		saving = true;
		saved = false;

		const features = (geoman as Geoman).features;
		const polygons = features.getAll().features.map((feature) => {
			return {
				code: null,
				geometry: feature.geometry
			};
		});

		const request = await fetch('/api/turf/create', {
			method: 'POST',
			body: JSON.stringify({
				polygons: polygons
			})
		});

		saving = false;

		if (request.ok) {
			saved = true;
			await goto('/system/turfs');
		}
	}

	onMount(() => {
		(async () => {
			const { Geoman } = await import('@geoman-io/maplibre-geoman-free');
			await import('@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css');

			map = new maplibregl.Map({
				container: mapContainer,
				style: 'https://tiles.openfreemap.org/styles/positron',
				center: [-75.2238, 40.0259],
				zoom: DEFAULT_ZOOM
			});

			// Initialize Geoman
			geoman = new Geoman(map, {
				settings: {
					controlsPosition: 'top-right',
					controlsUiEnabledByDefault: false
				},
				controls: {
					draw: {
						polygon: { uiEnabled: true }
					},
					edit: {
						drag: { active: false },
						delete: { uiEnabled: true },
						change: { uiEnabled: true }
					},
					helper: {
						snapping: { uiEnabled: true, active: true },
						click_to_edit: { uiEnabled: true, active: true }
					}
				}
			});

			map.on('gm:loaded', () => {
				console.log('Geoman fully loaded');
			});

			map.on('load', () => {
				fetchLocations(map.getBounds());
			});

			// Fetch locations whenever map moves
			map.on('moveend', () => {
				fetchLocations(map.getBounds());
			});
		})();

		// Return cleanup function synchronously
		return () => {
			if (map) {
				map.remove();
			}
		};
	});
</script>

<div class="wrapper">
	<div bind:this={mapContainer} class="map-container"></div>
	<div class="toolbar">
		<Button variant="outline" href="/system/turfs" class="!bg-surface">← Back to Turfs</Button>
		<Button onclick={saveTurfs} loading={saving} disabled={saved}>
			{saving ? 'Saving turf...' : saved ? 'Saved!' : 'Save Turf'}
		</Button>
	</div>
</div>

<style>
	.wrapper {
		position: relative;
	}

	.map-container {
		width: 100vw;
		height: 100vh;
	}

	.toolbar {
		position: absolute;
		top: 10px;
		left: 10px;
		display: flex;
		gap: 8px;
		align-items: center;
	}
</style>
