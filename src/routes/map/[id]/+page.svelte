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

    import { mount, onMount } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
	import MapMarker from '../../../stories/MapMarker.svelte';

    let selectedLocationId = $state<number | null>(null);
    let selectedLocation = $state<Location | null>(null);
    let showPanel = $state(false);

    let { data } = $props()

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
            markers.forEach(m => {
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
            props: { state },
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
        
        markers.forEach(m => {
            //@ts-ignore
            m.state.isSelected = false;
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
    {#if showPanel }
        <div class="panel flex flex-col gap-2">
            <div class="flex justify-between items-start">
                <h3>{ selectedLocation?.loc_name }</h3>
                <button class="cursor-pointer" aria-label="close" onclick={() => { closePanel() }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
                        <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
            <div>
                <p class="font-medium">{ selectedLocation?.street }</p>
                <p class="text-sm">{ selectedLocation?.locality }, {selectedLocation?.region} { selectedLocation?.postcode }</p>
            </div>
            <div class="flex justify-end flex-col flex-1 mt-4">
                <a href="/map/{data.turfId.toString()}/location/{selectedLocation?.id}" class="cursor-pointer bg-blue-500 px-3 py-2 rounded-full font-bold text-white block text-center">Open Location</a>
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
        background-color: #FFF;
        border-radius: 5px;
        box-shadow: 0px 0px 5px rgba(0,0,0,0.15);
        padding: 15px;
    }

    .panel h3 {
        font-size: 1.2rem;
        font-weight: 600;
    }
</style>