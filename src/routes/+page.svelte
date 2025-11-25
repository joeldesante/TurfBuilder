<script lang="ts">
    import { onMount } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';

    let mapContainer: HTMLDivElement;
    const DEFAULT_ZOOM = 18;

    onMount(() => {
        const map = new maplibregl.Map({
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
</style>