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

    let mapContainer: HTMLDivElement;
    const DEFAULT_ZOOM = 18;

    let map: maplibregl.Map;
    let locations: Location[] = [];
    let markers: maplibregl.Marker[] = [];

    async function fetchLocations(bounds: maplibregl.LngLatBounds) {
        const response = await fetch(`/api/locations?` +
            `lat_min=${bounds.getSouth()}&lat_max=${bounds.getNorth()}` +
            `&lon_min=${bounds.getWest()}&lon_max=${bounds.getEast()}`);
        locations = await response.json();
        console.log('Loaded locations:', locations);

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

    onMount(() => {
        map = new maplibregl.Map({
            container: mapContainer,
            style: 'https://tiles.openfreemap.org/styles/positron',
            center: [-75.2238, 40.0259],
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
            geolocateControl.trigger();
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
    <div bind:this={mapContainer} class="map-container"></div>
</div>

<style>
    .map-container {
        width: 100vw;
        height: 100vh;
    }

    .map-marker {
        width: 20px;
        height: 20px;
        background-color: #ff5722; /* any color you want */
        border: 2px solid white;   /* optional border */
        border-radius: 50%;        /* makes it round */
        box-shadow: 0 0 5px rgba(0,0,0,0.3); /* optional shadow */
        z-index: 9999;
    }
</style>