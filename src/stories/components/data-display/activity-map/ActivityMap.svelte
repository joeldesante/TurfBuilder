<script lang="ts" module>
	export type ActivityStatus = 'unvisited' | 'no-contact' | 'contacted';

	export interface ActivityPoint {
		id: string;
		longitude: number;
		latitude: number;
		status: ActivityStatus;
		/** Shown beside the point when it is selected, and on its own when zoomed in and there is room. */
		name?: string | null;
	}

	/** Below this zoom only the heatmap and unvisited specks are drawn. */
	export const DETAIL_ZOOM = 15;

	/**
	 * From this zoom, names show wherever they fit. Few fit when
	 * zoomed out; more appear as the map zooms in and points spread apart.
	 */
	export const LABEL_ZOOM = 14.5;
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import { themeStore } from '$lib/theme.svelte';
	import { getMapStyle } from '$lib/map-style';

	import 'maplibre-gl/dist/maplibre-gl.css';

	/**
	 * Canvassing activity for an area. Zoomed out it is a heatmap of visits with
	 * unvisited places as small specks, so gaps are easy to spot; past
	 * DETAIL_ZOOM each place is a point coloured by whether anyone answered. Everything is drawn
	 * by maplibre layers, not DOM markers, so it stays light on low-end devices.
	 */
	interface Props {
		points: ActivityPoint[];
		/** Bindable. The point the user clicked, or null. */
		selectedId?: string | null;
		class?: string;
	}

	let { points, selectedId = $bindable(null), class: className = '' }: Props = $props();

	let container: HTMLDivElement;
	let map: maplibregl.Map | undefined;
	let zoom = $state(0);
	let loaded = $state(false);
	let detailed = $derived(zoom >= DETAIL_ZOOM);

	function isDark() {
		return document.documentElement.getAttribute('data-theme') === 'dark';
	}

	function toGeoJSON(list: ActivityPoint[]): GeoJSON.FeatureCollection {
		return {
			type: 'FeatureCollection',
			features: list.map((p) => ({
				type: 'Feature',
				properties: {
					id: p.id,
					name: p.name ?? '',
					status: p.status,
					visited: p.status !== 'unvisited',
					selected: p.id === selectedId
				},
				geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] }
			}))
		};
	}

	function addLayers() {
		if (!map) return;
		map.addSource('activity', { type: 'geojson', data: toGeoJSON(points) });
		map.addLayer({
			id: 'activity-heat',
			type: 'heatmap',
			source: 'activity',
			maxzoom: DETAIL_ZOOM + 1,
			filter: ['==', ['get', 'visited'], true],
			paint: {
				'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 11, 10, 15, 30],
				'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 15, 1.2],
				'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,188,125,0)', 0.2, '#a4f4cf', 0.45, '#00bc7d', 0.75, '#007a55', 1, '#004f3b'],
				'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], DETAIL_ZOOM - 1, 0.8, DETAIL_ZOOM + 0.5, 0]
			}
		});
		map.addLayer({
			id: 'activity-unvisited',
			type: 'circle',
			source: 'activity',
			filter: ['==', ['get', 'visited'], false],
			paint: {
				// Zoom has to be the outer expression in maplibre, so the selection is decided per stop.
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, ['case', ['get', 'selected'], 7, 1.5], 17, ['case', ['get', 'selected'], 7, 4.5]],
				'circle-color': '#ffffff',
				'circle-stroke-color': ['case', ['get', 'selected'], '#004f3b', '#2b7fff'],
				'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, ['case', ['get', 'selected'], 3, 1], 17, ['case', ['get', 'selected'], 3, 1.75]]
			}
		});
		map.addLayer({
			id: 'activity-visited',
			type: 'circle',
			source: 'activity',
			minzoom: DETAIL_ZOOM,
			filter: ['==', ['get', 'visited'], true],
			paint: {
				'circle-radius': ['case', ['==', ['get', 'status'], 'no-contact'], 4, ['get', 'selected'], 9, 6.5],
				'circle-color': ['case', ['==', ['get', 'status'], 'contacted'], '#008236', '#52525c'],
				'circle-stroke-color': ['case', ['get', 'selected'], '#18181b', '#ffffff'],
				'circle-stroke-width': ['case', ['get', 'selected'], 3, 1.5]
			}
		});
		// Names, the way Google Maps labels places: beside the point, only where they
		// fit. Collision detection drops the ones that would overlap; visited places win.
		const labelLayout: maplibregl.SymbolLayerSpecification['layout'] = {
			'text-field': ['get', 'name'],
			'text-font': ['Noto Sans Regular'],
			'text-size': ['interpolate', ['linear'], ['zoom'], LABEL_ZOOM, 11, 18, 13],
			'text-anchor': 'left',
			'text-offset': [0.9, 0],
			'text-max-width': 10,
			'text-optional': true
		};
		const labelPaint = { 'text-color': '#18181b', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 };
		map.addLayer({
			id: 'activity-label',
			type: 'symbol',
			source: 'activity',
			minzoom: LABEL_ZOOM,
			filter: ['!=', ['get', 'name'], ''],
			layout: {
				...labelLayout,
				// Lower sorts first: visited places, then the rest.
				'symbol-sort-key': ['case', ['get', 'visited'], 0, 1],
				// Wide spacing when zoomed out keeps it to a few names; it tightens as you zoom in.
				'text-padding': ['interpolate', ['linear'], ['zoom'], LABEL_ZOOM, 24, 17, 6, 19, 2]
			},
			paint: labelPaint
		});
		// The selected point's name, drawn even where the labels above leave it out.
		map.addLayer({
			id: 'activity-label-focus',
			type: 'symbol',
			source: 'activity',
			filter: ['==', ['get', 'id'], ''],
			layout: {
				...labelLayout,
				'text-font': ['Noto Sans Bold'],
				'text-allow-overlap': true,
				'text-ignore-placement': true
			},
			// Same label as above, forced on and set in dark green so the selection stands out.
			paint: { ...labelPaint, 'text-color': '#004f3b', 'text-halo-width': 2 }
		});
		updateFocusLabel();

		for (const layer of ['activity-visited', 'activity-unvisited']) {
			map.on('click', layer, (e) => {
				const id = e.features?.[0]?.properties?.id as string | undefined;
				if (!id) return;
				selectedId = id;
			});
			map.on('mouseenter', layer, () => (map!.getCanvas().style.cursor = 'pointer'));
			map.on('mouseleave', layer, () => (map!.getCanvas().style.cursor = ''));
		}
	}

	function updateFocusLabel() {
		if (!map?.getLayer('activity-label-focus')) return;
		const id = selectedId ?? '';
		// The selected point's label moves from the automatic layer to the forced one,
		// so it is only ever drawn once.
		map.setFilter('activity-label', ['all', ['!=', ['get', 'name'], ''], ['!=', ['get', 'id'], id]]);
		map.setFilter('activity-label-focus', ['==', ['get', 'id'], id]);
	}

	$effect(() => {
		void selectedId;
		updateFocusLabel();
	});

	const FIT = { padding: 60, maxZoom: 16 };

	function boundsOf(list: ActivityPoint[]) {
		const b = new maplibregl.LngLatBounds();
		for (const p of list) b.extend([p.longitude, p.latitude]);
		return b;
	}

	// Keep the source in step with the points and the selection.
	$effect(() => {
		const data = toGeoJSON(points);
		const source = map?.getSource('activity') as maplibregl.GeoJSONSource | undefined;
		source?.setData(data);
	});

	// Frame the whole dataset again when a new set of points arrives (another
	// bucket or range), not on selection changes.
	let lastFitted: ActivityPoint[] | null = null;
	$effect(() => {
		if (!map || !loaded || points === lastFitted) return;
		const first = lastFitted === null;
		lastFitted = points;
		// The map already opened on these points.
		if (first || points.length === 0) return;
		map.fitBounds(boundsOf(points), { ...FIT, duration: 300 });
	});

	$effect(() => {
		const dark = themeStore.theme === 'dark' || (themeStore.theme !== 'light' && isDark());
		if (map) {
			// @ts-expect-error getMapStyle returns a plain object rather than a StyleSpecification
			getMapStyle(dark).then((style) => map!.setStyle(style));
		}
	});

	onMount(() => {
		(async () => {
			const style = await getMapStyle(isDark());
			map = new maplibregl.Map({
				container,
				// @ts-expect-error getMapStyle returns a plain object rather than a StyleSpecification
				style,
				// Open on the whole dataset; fall back to Philadelphia when there is nothing to show.
				...(points.length > 0
					? { bounds: boundsOf(points), fitBoundsOptions: FIT }
					: { center: [-75.2238, 40.0259] as [number, number], zoom: 12 }),
				attributionControl: { compact: true }
			});
			map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
			// style.load fires again after every setStyle, which drops custom layers.
			map.on('style.load', addLayers);
			map.on('zoom', () => (zoom = map!.getZoom()));
			map.once('load', () => {
				zoom = map!.getZoom();
				loaded = true;
			});
		})();
		return () => map?.remove();
	});
</script>

<!-- Inline positioning, as in LocationsMap: maplibre's stylesheet sets .maplibregl-map
     to position: relative, which overrides Tailwind classes and collapses the map to zero height. -->
<div class={className} style="position: relative;">
	<div bind:this={container} style="position: absolute; inset: 0;"></div>
	<div class="pointer-events-none absolute left-3 top-3 z-10 flex gap-2">
		<span class="rounded-full border border-outline bg-surface px-3 py-1 text-xs text-on-surface-subtle">
			{detailed ? 'Showing each business' : 'Zoom in to see each business'}
		</span>
	</div>
</div>
