<script lang="ts">
    type Location = {
        id: number;
        loc_name: string;
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
    import maplibregl from 'maplibre-gl';

    import 'maplibre-gl/dist/maplibre-gl.css';
    import '@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css';
	import type { FeatureData, FeatureId, FeatureStore, Geoman } from '@geoman-io/maplibre-geoman-free';

    let mapContainer: HTMLDivElement;
    const DEFAULT_ZOOM = 18;

    let map: maplibregl.Map;
    let locations: Location[] = [];
    let markers: maplibregl.Marker[] = [];
    let geoman: Geoman | undefined;

    async function fetchLocations(bounds: maplibregl.LngLatBounds) {
        const response = await fetch(`/api/locations?` +
            `lat_min=${bounds.getSouth()}&lat_max=${bounds.getNorth()}` +
            `&lon_min=${bounds.getWest()}&lon_max=${bounds.getEast()}`);
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
                .setPopup(new maplibregl.Popup().setText(loc.loc_name))
                .addTo(map);

            markers.push(marker);
        });
    }

    async function saveTurfs() {
        if(!geoman) return;
        geoman = geoman as Geoman;

        const features = (geoman as Geoman).features;
        const polygons = features.getAll().features.map((feature) => {
            return {
                code: null,
                geometry: feature.geometry
            }
        });

        const request = await fetch('/api/turf/create', {
            method: 'POST',
            body: JSON.stringify({
                polygons: polygons
            })
        })

        if(request.ok) {
            console.log(request.json());
        }
    }

    onMount(() => {
        (async () => {
            const { Geoman } = await import("@geoman-io/maplibre-geoman-free");
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
                        polygon: { uiEnabled: true },
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
    <div class="save rounded-sm bg-blue-500 shadow-lg font-bold text-white cursor-pointer select-none border-2 border-blue-600" onclick={saveTurfs}>
        <span>Save Turf</span>
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

    .map-marker {
        width: 20px;
        height: 20px;
        background-color: #000;
        border-radius: 100%;
        box-shadow: 0 0 5px rgba(0,0,0,0.3); 
        z-index: 9999;
    }

    .save {
        position: absolute;
        right: 50px;
        top: 10px;
        width: 200px;
        height: 50px;
        padding: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>