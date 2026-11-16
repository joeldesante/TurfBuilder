<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import MapView from './MapView.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Display/Map View',
		component: MapView,
		tags: ['autodocs'],
		argTypes: {
			markerStyle: { control: 'inline-radio', options: ['pin', 'dot'] },
			cluster: { control: 'boolean' },
			showLayers: { control: 'boolean' },
			layerToggles: { control: 'boolean' }
		}
	});

	const sampleLocations = [
		{ id: 'loc-1', name: 'Community Center', address_line_1: '100 Main St', city: 'Philadelphia', latitude: 40.0259, longitude: -75.2238 },
		{ id: 'loc-2', name: 'Public Library', address_line_1: '250 Market St', city: 'Philadelphia', latitude: 40.031, longitude: -75.218 },
		{ id: 'loc-3', name: null, address_line_1: '87 Elm Ave', city: 'Philadelphia', latitude: 40.021, longitude: -75.229 }
	];

	/** Enough points around one center that clustering has something to merge. */
	const denseLocations = Array.from({ length: 2000 }, (_, i) => ({
		id: `dense-${i}`,
		name: `Location ${i + 1}`,
		latitude: 40.0 + Math.sin(i * 12.9898) * 0.06,
		longitude: -75.18 + Math.cos(i * 78.233) * 0.08
	}));

	const square = (west: number, south: number, size: number) => ({
		type: 'Polygon',
		coordinates: [
			[
				[west, south],
				[west + size, south],
				[west + size, south + size],
				[west, south + size],
				[west, south]
			]
		]
	});

	const sampleLayers = [
		{
			id: 'wards',
			name: 'Wards',
			color: '#2f6fed',
			labelField: 'WARD',
			geojson: {
				type: 'FeatureCollection',
				features: [
					{ type: 'Feature', properties: { WARD: '5' }, geometry: square(-75.24, 40.015, 0.015) },
					{ type: 'Feature', properties: { WARD: '6' }, geometry: square(-75.222, 40.015, 0.015) }
				]
			}
		},
		{
			id: 'parks',
			name: 'Parks',
			color: '#2a9d4b',
			labelField: null,
			geojson: { type: 'Feature', properties: { NAME: 'Fairmount' }, geometry: square(-75.235, 40.03, 0.01) }
		}
	];
</script>

<Story name="Pins" args={{ locations: sampleLocations, class: 'w-full h-[480px]' }} />

<Story name="Dense Dots" args={{ locations: denseLocations, markerStyle: 'dot', class: 'w-full h-[480px]' }} />

<Story
	name="Layer Toggles"
	args={{ locations: sampleLocations, layers: sampleLayers, layerToggles: true, class: 'w-full h-[480px]' }}
/>

<Story name="Loading Locations" args={{ locations: [], locationsLoading: true, class: 'w-full h-[480px]' }} />
