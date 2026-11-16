<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import MapEditorPage from './MapEditorPage.svelte';
	import type { MapLayer } from '$lib/shared/types/map-layers';

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

	const layers: MapLayer[] = [
		{
			id: 'wards',
			name: 'Wards',
			color: '#2f6fed',
			label_field: 'WARD',
			position: 0,
			geojson: {
				type: 'FeatureCollection',
				features: [
					{ type: 'Feature', properties: { WARD: '5' }, geometry: square(-75.24, 40.0, 0.02) },
					{ type: 'Feature', properties: { WARD: '6' }, geometry: square(-75.21, 40.0, 0.02) }
				]
			},
			created_at: '2026-11-16T00:00:00Z',
			updated_at: '2026-11-16T00:00:00Z'
		}
	];

	// The callbacks answer as the API would, without a server.
	const saved = (input: { name: string; color: string; label_field: string | null; geojson: MapLayer['geojson'] }) =>
		Promise.resolve({
			...input,
			id: crypto.randomUUID(),
			position: 0,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		});

	const { Story } = defineMeta({
		title: 'Pages/Universe/Data/Map Editor',
		component: MapEditorPage,
		parameters: { layout: 'fullscreen' },
		args: {
			dashboardHref: '#',
			onCreate: saved,
			onUpdate: (id: string) => Promise.resolve(layers.find((l) => l.id === id)!),
			onDelete: () => Promise.resolve(),
			onReorder: () => Promise.resolve()
		}
	});
</script>

<Story name="With Layers" args={{ layers }} />

<Story name="Empty" args={{ layers: [] }} />
