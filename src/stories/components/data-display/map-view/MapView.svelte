<script lang="ts" module>
	export interface MapLocation {
		id: string;
		name: string | null;
		address_line_1?: string | null;
		city?: string | null;
		latitude: number;
		longitude: number;
	}

	/** A viewport, in degrees. */
	export interface MapBounds {
		west: number;
		south: number;
		east: number;
		north: number;
	}

	/**
	 * How single locations are drawn. `pin` is the large, tappable marker of the
	 * walk map. `dot` is a small circle painted on the map canvas, which stays
	 * fast and readable on maps with thousands of locations.
	 */
	export type MarkerStyle = 'pin' | 'dot';

	import type {
		MapLayerData as LayerData,
		MarkerVariant as Variant
	} from '$lib/client/map-view';
	export type MarkerVariant = Variant;
	export type MapLayerData = LayerData;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getAllContexts, mount, onMount, unmount, untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import maplibregl from 'maplibre-gl';
	import { themeStore } from '$lib/theme.svelte';
	import { getMapStyle } from '$lib/map-style';
	import { geojsonBounds } from '$lib/shared/utils/geojson-bounds';
	import type { LayerGeoJSON } from '$lib/shared/types/map-layers';
	import {
		CLUSTER_COUNT_LAYER,
		CLUSTER_LAYER,
		DOT_LAYER,
		POINT_SOURCE,
		SERVER_CLUSTER_COUNT_LAYER,
		SERVER_CLUSTER_LAYER,
		SERVER_CLUSTER_SOURCE,
		clusterLayers,
		serverClusterFeatures,
		type MapCluster,
		dotLayer,
		geoLayerSpecs,
		labelText,
		layerSourceId,
		layerStyleIds,
		pointFeatures,
		pointSource
	} from '$lib/client/map-view';
	import MapMarker from '$components/data-display/map-marker/MapMarker.svelte';
	import MapPopup from '$components/data-display/map-popup/MapPopup.svelte';
	import SnippetHost from '$components/layout/snippet-host/SnippetHost.svelte';
	import Spinner from '$components/feedback/spinner/Spinner.svelte';
	import MapLayerToggles from '$components/data-display/map-layer-toggles/MapLayerToggles.svelte';
	import { toast } from 'svelte-sonner';
	import { api, errorMessage } from '$lib/client/api';
	import SmileyIcon from 'phosphor-svelte/lib/Smiley';

	import 'maplibre-gl/dist/maplibre-gl.css';

	/**
	 * The one map used across the app. It draws locations (as pins or dots, with
	 * nearby ones merged into count bubbles when zoomed out), GeoJSON layers
	 * under them, and an optional turf outline, and shows a loading bar while
	 * tiles and locations load.
	 */
	interface Props {
		locations?: MapLocation[];
		/** The id of the location currently selected on the map, or null. Bindable. */
		selectedLocationId?: string | null;
		/** Set while the parent is still fetching locations so the loading indicator reflects it. */
		locationsLoading?: boolean;
		/** Pins (large, for phones) or dots (small, for dense maps). Defaults to pins. */
		markerStyle?: MarkerStyle;
		/**
		 * Merge nearby locations into a bubble with a count when zoomed out, so a
		 * dense map stays readable and fast. Zooming in splits them apart.
		 * Defaults to on.
		 */
		cluster?: boolean;
		/**
		 * GeoJSON layers drawn under the locations, top of the list on top. Keep
		 * them out of deep `$state` (use `$state.raw`, or plain props): a layer can
		 * hold hundreds of thousands of nested arrays, and watching each one stalls
		 * the page. The GeoJSON is handed to MapLibre as is.
		 */
		layers?: MapLayerData[];
		/**
		 * Show a list of `layers` over the map with a checkbox for each, so the
		 * viewer can turn layers on and off. Defaults to off.
		 */
		layerToggles?: boolean;
		/** Draw `layers`. Off hides them all without unloading them. Defaults to on. */
		showLayers?: boolean;
		/**
		 * Hovering a layer shape shows its label or layer name, and clicking it
		 * opens a popup with its properties. Defaults to on.
		 */
		layerDetails?: boolean;
		/**
		 * Fetches a layer's shapes the first time it is turned on, for layers
		 * passed without `geojson`. Defaults to `GET /api/v1/map-layers/{id}`.
		 */
		loadLayer?: (id: string) => Promise<LayerGeoJSON>;
		/** Fallback center when there are no locations to fit. */
		defaultCenter?: [number, number];
		defaultZoom?: number;
		/**
		 * Opening viewport. Takes precedence over fitting to `locations`, which is
		 * what a caller loading locations per viewport wants: the map has to be
		 * somewhere sensible before it can report what to load.
		 */
		initialBounds?: MapBounds | null;
		/**
		 * Fired once the map has settled, with the area now on screen. Lets a
		 * caller fetch the locations that fall inside it instead of passing a
		 * fixed set. Also fires once on load, so the first viewport is not missed.
		 */
		onViewportChange?: (bounds: MapBounds, zoom: number) => void;
		/**
		 * Bubbles the server merged locations into, for a map that loads per
		 * viewport and would be too full to draw every location. Drawn like the
		 * map's own clusters; clicking one zooms in on it.
		 */
		clusters?: MapCluster[];
		class?: string;
		/** Overlay content rendered above the map (buttons, legends, etc.). */
		children?: Snippet;
		/**
		 * Marker colour per location. Defaults to 'unvisited' for every marker.
		 * Reactive state read inside it updates the markers as it changes.
		 */
		variantFor?: (loc: MapLocation) => MarkerVariant;
		/**
		 * Popup body for a location. When omitted each location gets the default
		 * name-and-address popup; pass `null` to suppress popups entirely (useful
		 * when the parent drives its own detail panel instead).
		 */
		popup?: Snippet<[MapLocation]> | null;
		/** Refit the viewport to the locations whenever the set of them changes. */
		autoFit?: boolean;
		/** Adds maplibre's own geolocate control to the map. */
		geolocate?: boolean;
		/** Turns the next map click into a pin drop rather than a pan. */
		pinDropMode?: boolean;
		onPinDrop?: (coords: { latitude: number; longitude: number }) => void;
		/**
		 * A pin for a location that does not exist yet, shown while its details
		 * are being filled in. Draggable, so the position can be nudged before
		 * saving.
		 */
		draftPin?: { latitude: number; longitude: number } | null;
		onDraftMove?: (coords: { latitude: number; longitude: number }) => void;
		/**
		 * A small round grip the user can drag, e.g. on the edge of a circle to
		 * resize it. `onHandleDrag` fires continuously while it moves so the
		 * shape it controls can follow.
		 */
		handle?: { latitude: number; longitude: number } | null;
		onHandleDrag?: (coords: { latitude: number; longitude: number }) => void;
		/**
		 * Where the viewer is, drawn as a pulsing dot. Supplied by the caller
		 * rather than read here, so a page that already watches the position for
		 * its own controls does not open a second geolocation subscription.
		 */
		userPosition?: { latitude: number; longitude: number } | null;
		/**
		 * The one location the user may reposition by dragging, if any. It is
		 * always drawn as a pin and never merged into a bubble, so it can be grabbed.
		 */
		draggableLocationId?: string | null;
		onLocationMove?: (id: string, coords: { latitude: number; longitude: number }) => void;
		/** Outline drawn over the map, typically the bounds of a turf. */
		boundsGeoJSON?: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
	}

	let {
		locations = [],
		selectedLocationId = $bindable(null),
		locationsLoading = false,
		markerStyle = 'pin',
		cluster = true,
		layers = [],
		layerToggles = false,
		loadLayer,
		showLayers = true,
		layerDetails = true,
		defaultCenter = [-75.2238, 40.0259],
		defaultZoom = 12,
		initialBounds = null,
		onViewportChange,
		clusters = [],
		class: className = '',
		children,
		variantFor,
		popup,
		autoFit = true,
		geolocate = false,
		pinDropMode = false,
		onPinDrop,
		draftPin = null,
		onDraftMove,
		handle = null,
		onHandleDrag,
		userPosition = null,
		draggableLocationId = null,
		onLocationMove,
		boundsGeoJSON = null
	}: Props = $props();

	// Contexts are handed to popup content mounted by hand, so it renders as if it were here.
	const contexts = getAllContexts();

	let mapContainer: HTMLDivElement;
	let map: maplibregl.Map | undefined;
	let mapReady = $state(false);

	/**
	 * Bumped each time a map style finishes loading. A new style (the theme
	 * changing) drops every source and layer added at runtime, so everything
	 * drawn here reads this and is added again.
	 */
	let styleVersion = $state(0);
	/** Sources added to the current style. Cleared when the style is replaced. */
	// Plain, not SvelteSet/SvelteMap: this tracks what is on the map, and the effects
	// that write it must not rerun because they wrote it.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const added = new Set<string>();

	let mapLoading = $state(false);
	let mapLoadingComplete = $state(false);
	let tilesTotal = $state(0);
	let tilesLoaded = $state(0);

	const locationsById = $derived(new Map(locations.map((l) => [l.id, l])));
	const variantOf = (loc: MapLocation): MarkerVariant => variantFor?.(loc) ?? 'unvisited';

	function isDarkTheme() {
		return document.documentElement.getAttribute('data-theme') === 'dark';
	}

	function toLngLatBounds(b: MapBounds): maplibregl.LngLatBounds {
		return new maplibregl.LngLatBounds([b.west, b.south], [b.east, b.north]);
	}

	function locationBounds(locs: MapLocation[]): maplibregl.LngLatBounds {
		return locs.reduce(
			(b, l) => b.extend([l.longitude, l.latitude]),
			new maplibregl.LngLatBounds(
				[locs[0].longitude, locs[0].latitude],
				[locs[0].longitude, locs[0].latitude]
			)
		);
	}

	/** The area on screen, or null before the map exists. */
	export function getViewBounds(): MapBounds | null {
		if (!map) return null;
		const b = map.getBounds();
		return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
	}

	function reportViewport() {
		if (!onViewportChange) return;
		const bounds = getViewBounds();
		if (bounds && map) onViewportChange(bounds, map.getZoom());
	}

	/** The first location layer, so shapes added under it stay below the locations. */
	function beneathPoints(): string | undefined {
		if (!map) return undefined;
		return [SERVER_CLUSTER_LAYER, CLUSTER_LAYER, DOT_LAYER, SERVER_CLUSTER_COUNT_LAYER, CLUSTER_COUNT_LAYER].find((id) =>
			map!.getLayer(id)
		);
	}

	// ---------------------------------------------------------------- Popups

	let locationPopup: maplibregl.Popup | undefined;
	let popupComponent: Record<string, unknown> | undefined;

	function closePopup() {
		const open = locationPopup;
		locationPopup = undefined;
		open?.remove();
		if (popupComponent) unmount(popupComponent);
		popupComponent = undefined;
	}

	/** Opens the popup of a location: the caller's snippet, or the default name and address. */
	function openPopup(loc: MapLocation) {
		closePopup();
		if (popup === null || !map) return;

		const content = document.createElement('div');
		popupComponent = popup
			? mount(SnippetHost, {
					target: content,
					// mount() cannot carry the generic, so the snippet's argument type is restated here.
					props: { snippet: popup as Snippet<[unknown]>, arg: loc },
					context: contexts
				})
			: mount(MapPopup, {
					target: content,
					props: {
						locationName: loc.name ?? loc.address_line_1 ?? '',
						street: loc.address_line_1,
						locality: loc.city
					}
				});

		const pinned = markerStyle === 'pin' || loc.id === draggableLocationId;
		const opened = new maplibregl.Popup({ offset: pinned ? 34 : 10 })
			.setLngLat([loc.longitude, loc.latitude])
			.setDOMContent(content)
			.addTo(map);
		opened.on('close', () => {
			if (locationPopup !== opened) return;
			locationPopup = undefined;
			if (popupComponent) unmount(popupComponent);
			popupComponent = undefined;
		});
		locationPopup = opened;
	}

	function selectLocation(loc: MapLocation) {
		selectedLocationId = loc.id;
		openPopup(loc);
	}

	// A selected location that is no longer in the list is let go, popup and all.
	$effect(() => {
		const id = selectedLocationId;
		if (id && !locationsById.has(id)) {
			untrack(() => {
				selectedLocationId = null;
				closePopup();
			});
		}
	});

	// ---------------------------------------------------------------- Pins

	/** Builds the element of a pin: a named button that selects its location on click or Enter. */
	function pinElement(id: string): HTMLElement {
		const loc = () => locationsById.get(id);
		const element = document.createElement('div');
		element.setAttribute('role', 'button');
		element.tabIndex = 0;
		const current = loc();
		element.setAttribute(
			'aria-label',
			[current?.name, current?.address_line_1].filter(Boolean).join(', ') || 'Location'
		);
		element.addEventListener('click', (e) => {
			// Keeps the click from reaching the map, where it would count as a click on the shapes below.
			e.stopPropagation();
			const l = loc();
			if (l) selectLocation(l);
		});
		element.addEventListener('keydown', (e) => {
			if (e.key !== 'Enter' && e.key !== ' ') return;
			e.preventDefault();
			const l = loc();
			if (l) selectLocation(l);
		});

		mount(MapMarker, {
			target: element,
			props: {
				get variant() {
					const l = loc();
					return l ? variantOf(l) : 'unvisited';
				},
				get isSelected() {
					return selectedLocationId === id;
				}
			}
		});
		return element;
	}

	/** Pins on the map now, by location id. Only single, on-screen locations get one. */
	// Plain, not SvelteSet/SvelteMap: this tracks what is on the map, and the effects
	// that write it must not rerun because they wrote it.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const pins = new Map<string, maplibregl.Marker>();

	function clearPins() {
		for (const marker of pins.values()) marker.remove();
		pins.clear();
	}

	/**
	 * Makes the pins match the single locations MapLibre has placed in view.
	 * Building an HTML pin for every location would stall the page on a big
	 * list, so the clustered source decides which ones are worth a pin.
	 */
	function syncPins() {
		if (!map || markerStyle !== 'pin' || !added.has(POINT_SOURCE)) {
			clearPins();
			return;
		}

		// A feature can come back once per tile it touches, so the ids go through a Set.
		const wanted = new Set(
			map
				.querySourceFeatures(POINT_SOURCE)
				.filter((f) => !f.properties?.cluster)
				.map((f) => f.properties?.id)
				.filter((id): id is string => typeof id === 'string' && locationsById.has(id))
		);

		for (const [id, marker] of pins) {
			if (!wanted.has(id)) {
				marker.remove();
				pins.delete(id);
			}
		}
		for (const id of wanted) {
			const loc = locationsById.get(id)!;
			const existing = pins.get(id);
			if (existing) {
				existing.setLngLat([loc.longitude, loc.latitude]);
				continue;
			}
			const marker = new maplibregl.Marker({ element: pinElement(id), anchor: 'bottom' })
				.setLngLat([loc.longitude, loc.latitude])
				.addTo(map);
			pins.set(id, marker);
		}
	}

	// ---------------------------------------------------------------- Locations

	/** Every location but the draggable one, which gets its own pin so it never hides in a bubble. */
	const pointData = $derived(
		pointFeatures(
			locations.filter((l) => l.id !== draggableLocationId),
			variantOf
		)
	);

	/** The cluster and marker settings the point source was built with. */
	let pointConfig: string | null = null;

	function removePoints() {
		if (!map) return;
		for (const id of [CLUSTER_COUNT_LAYER, CLUSTER_LAYER, DOT_LAYER]) {
			if (map.getLayer(id)) map.removeLayer(id);
		}
		if (added.has(POINT_SOURCE)) map.removeSource(POINT_SOURCE);
		added.delete(POINT_SOURCE);
	}

	$effect(() => {
		const data = pointData;
		const config = `${cluster}:${markerStyle}`;
		void styleVersion;
		if (!mapReady || !map) return;

		untrack(() => {
			if (added.has(POINT_SOURCE) && pointConfig !== config) removePoints();

			if (added.has(POINT_SOURCE)) {
				(map!.getSource(POINT_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(data);
			} else {
				map!.addSource(POINT_SOURCE, pointSource(data, cluster));
				added.add(POINT_SOURCE);
				pointConfig = config;
				if (cluster) for (const layer of clusterLayers()) map!.addLayer(layer);
				if (markerStyle === 'dot') map!.addLayer(dotLayer(), beneathCounts());
				drawnSelection = null;
			}
			syncPins();
			showSelection(selectedLocationId);
		});
	});

	// Server bubbles get their own source: they are not locations, so they stay
	// out of the point source and its selection and pins.
	$effect(() => {
		const data = serverClusterFeatures(clusters);
		void styleVersion;
		if (!mapReady || !map) return;

		untrack(() => {
			if (added.has(SERVER_CLUSTER_SOURCE)) {
				(map!.getSource(SERVER_CLUSTER_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(data);
				return;
			}
			if (clusters.length === 0) return;
			map!.addSource(SERVER_CLUSTER_SOURCE, { type: 'geojson', data });
			added.add(SERVER_CLUSTER_SOURCE);
			for (const layer of clusterLayers(SERVER_CLUSTER_SOURCE, {
				bubble: SERVER_CLUSTER_LAYER,
				count: SERVER_CLUSTER_COUNT_LAYER
			})) {
				map!.addLayer(layer);
			}
		});
	});

	/** Dots go under the cluster counts so a count is never hidden by a dot. */
	function beneathCounts(): string | undefined {
		return map?.getLayer(CLUSTER_COUNT_LAYER) ? CLUSTER_COUNT_LAYER : undefined;
	}

	/** The location whose dot is drawn selected. */
	let drawnSelection: string | null = null;

	function showSelection(id: string | null) {
		if (!map || !added.has(POINT_SOURCE) || markerStyle !== 'dot') return;
		if (drawnSelection === id) return;
		if (drawnSelection) map.setFeatureState({ source: POINT_SOURCE, id: drawnSelection }, { selected: false });
		if (id) map.setFeatureState({ source: POINT_SOURCE, id }, { selected: true });
		drawnSelection = id;
	}

	$effect(() => {
		const id = selectedLocationId;
		if (!mapReady) return;
		untrack(() => showSelection(id));
	});

	/**
	 * Identity of the location set. Fitting off this rather than the array
	 * reference means a parent that re-creates `locations` on every status poll
	 * does not keep pulling the map back.
	 */
	const locationSignature = $derived(
		locations.map((l) => `${l.id}:${l.longitude}:${l.latitude}`).join('|')
	);
	let fittedSignature: string | null = null;

	$effect(() => {
		const signature = locationSignature;
		if (!mapReady || !map || !autoFit) return;
		if (signature === fittedSignature) return;
		fittedSignature = signature;
		const locs = untrack(() => locations);
		if (locs.length > 0) map.fitBounds(locationBounds(locs), { padding: 60, maxZoom: 16 });
	});

	// The draggable location, kept out of the point source so it can always be grabbed.
	let draggableMarker: { id: string; marker: maplibregl.Marker } | undefined;

	$effect(() => {
		const id = draggableLocationId;
		const loc = id ? locationsById.get(id) : undefined;
		if (!mapReady || !map) return;

		if (!id || !loc) {
			draggableMarker?.marker.remove();
			draggableMarker = undefined;
			return;
		}
		if (draggableMarker?.id === id) {
			draggableMarker.marker.setLngLat([loc.longitude, loc.latitude]);
			return;
		}

		draggableMarker?.marker.remove();
		const marker = new maplibregl.Marker({
			element: untrack(() => pinElement(id)),
			anchor: 'bottom',
			draggable: true
		})
			.setLngLat([loc.longitude, loc.latitude])
			.addTo(map);
		marker.on('dragend', () => {
			const { lng, lat } = marker.getLngLat();
			onLocationMove?.(id, { latitude: lat, longitude: lng });
		});
		draggableMarker = { id, marker };
	});

	// ---------------------------------------------------------------- GeoJSON layers

	/** Visibility the viewer chose in the layer list, by layer id. Overrides `visible`. */
	let toggled = $state<Record<string, boolean>>({});

	/**
	 * Whether a layer is on: the viewer's choice, else `visible`, else on only
	 * when the caller gave its shapes. A layer passed without shapes starts off,
	 * so nothing is downloaded until someone asks for it.
	 */
	const isLayerOn = (layer: { id: string; visible?: boolean; geojson?: unknown }) =>
		toggled[layer.id] ?? layer.visible ?? layer.geojson !== undefined;

	/**
	 * Shapes fetched for layers passed without them, by layer id. Raw: GeoJSON
	 * can be hundreds of thousands of nested arrays and must never be watched.
	 */
	let fetchedShapes = $state.raw<Record<string, LayerGeoJSON>>({});
	/** Layers whose shapes are being fetched now. */
	let fetching = $state.raw<Record<string, boolean>>({});

	const defaultLoadLayer = (id: string) =>
		api<{ geojson: LayerGeoJSON }>(`/map-layers/${id}`).then((layer) => layer.geojson);

	async function fetchShapes(layer: MapLayerData) {
		fetching = { ...fetching, [layer.id]: true };
		try {
			const geojson = await (loadLayer ?? defaultLoadLayer)(layer.id);
			fetchedShapes = { ...fetchedShapes, [layer.id]: geojson };
		} catch (e) {
			// Back off, so the list does not show a layer that is not there.
			toggled[layer.id] = false;
			toast.error(errorMessage(e, `The ${layer.name} layer could not be loaded.`));
		} finally {
			fetching = Object.fromEntries(Object.entries(fetching).filter(([id]) => id !== layer.id));
		}
	}

	// Fetch the shapes of every layer that is on but has none yet: one request per
	// layer, the first time it is turned on, then kept for the life of the map.
	$effect(() => {
		for (const layer of layers) {
			if (layer.geojson || fetchedShapes[layer.id] || fetching[layer.id]) continue;
			if (!isLayerOn(layer)) continue;
			untrack(() => fetchShapes(layer));
		}
	});

	/**
	 * `layers` with the viewer's choices and fetched shapes applied: what the map
	 * can draw. A layer still without shapes is left out until they arrive.
	 */
	const effectiveLayers = $derived(
		layers.flatMap((l) => {
			const geojson = l.geojson ?? fetchedShapes[l.id];
			return geojson ? [{ ...l, geojson, visible: isLayerOn(l) }] : [];
		})
	);

	/** Layers whose source and style layers are on the map now, by id. */
	// Plain, not SvelteSet/SvelteMap: this tracks what is on the map, and the effects
	// that write it must not rerun because they wrote it.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const drawnLayers = new Set<string>();

	function removeLayer(id: string) {
		if (!map) return;
		for (const styleId of layerStyleIds(id)) if (map.getLayer(styleId)) map.removeLayer(styleId);
		const source = layerSourceId(id);
		if (added.has(source)) map.removeSource(source);
		added.delete(source);
		drawnLayers.delete(id);
	}

	/** Makes the map's GeoJSON layers match `layers`: adds, recolors, hides, removes and orders them. */
	function syncLayers() {
		if (!map || !mapReady) return;
		const current = map;
		const shown = showLayers ? effectiveLayers : [];

		if (layerSelected && !isShown(layerSelected.source)) clearLayerSelection();
		if (layerHovered && !isShown(layerHovered.source)) clearLayerHover();

		const wanted = new Set(shown.map((l) => l.id));
		for (const id of [...drawnLayers]) if (!wanted.has(id)) removeLayer(id);

		for (const layer of shown) {
			const source = layerSourceId(layer.id);
			const [fillId, lineId, circleId, labelId] = layerStyleIds(layer.id);
			if (!added.has(source)) {
				// Handed over as is. Callers keep GeoJSON out of deep $state (see `layers`): a
				// snapshot of a watched layer walks every nested array, which stalled pages for seconds.
				const data = layer.geojson as unknown as GeoJSON.GeoJSON;
				current.addSource(source, { type: 'geojson', data, generateId: true });
				added.add(source);
				drawnLayers.add(layer.id);
				for (const spec of geoLayerSpecs(layer)) current.addLayer(spec, beneathPoints());
				continue;
			}
			current.setPaintProperty(fillId, 'fill-color', layer.color);
			current.setPaintProperty(lineId, 'line-color', layer.color);
			current.setPaintProperty(circleId, 'circle-color', layer.color);
			current.setLayoutProperty(labelId, 'text-field', labelText(layer.labelField));
			for (const id of layerStyleIds(layer.id)) {
				current.setLayoutProperty(id, 'visibility', layer.visible === false ? 'none' : 'visible');
			}
		}

		// The first layer in the list draws on top, so each moves up under the locations from the bottom up.
		for (const layer of [...shown].reverse()) {
			for (const id of layerStyleIds(layer.id)) current.moveLayer(id, beneathPoints());
		}
	}

	$effect(() => {
		// Read what the map shows so the effect reruns when it changes. Not the
		// GeoJSON itself: it never changes, and a deep read of it would be slow.
		void effectiveLayers.map((l) => [l.id, l.color, l.visible, l.labelField]);
		void showLayers;
		void styleVersion;
		void mapReady;
		untrack(syncLayers);
	});

	type FeatureRef = { source: string; id: string | number };

	let layerHovered: FeatureRef | null = null;
	let layerSelected: FeatureRef | null = null;
	let hoverPopup: maplibregl.Popup | undefined;
	let detailPopup: maplibregl.Popup | undefined;

	const sameFeature = (a: FeatureRef | null, b: FeatureRef | null) =>
		a?.source === b?.source && a?.id === b?.id;

	function layerForSource(source: string): MapLayerData | undefined {
		return effectiveLayers.find((l) => layerSourceId(l.id) === source);
	}

	function isShown(source: string) {
		const layer = layerForSource(source);
		return showLayers && !!layer && layer.visible !== false;
	}

	function setFeatureFlag(ref: FeatureRef | null, flag: 'hover' | 'selected', value: boolean) {
		if (map && ref && added.has(ref.source)) map.setFeatureState(ref, { [flag]: value });
	}

	/** The drawn parts (not labels) of every shown layer, which can be hovered and clicked. */
	function interactiveLayerIds(): string[] {
		const current = map;
		if (!current || !showLayers) return [];
		return effectiveLayers
			.filter((l) => l.visible !== false && drawnLayers.has(l.id))
			.flatMap((l) => layerStyleIds(l.id).slice(0, 3))
			.filter((id) => current.getLayer(id));
	}

	/** The top shape under the pointer, with a few pixels of slack so thin lines can be hit. */
	function shapeAt(point: maplibregl.Point) {
		const ids = interactiveLayerIds();
		if (!map || ids.length === 0) return null;
		const pad = 5;
		const hits = map.queryRenderedFeatures(
			[
				[point.x - pad, point.y - pad],
				[point.x + pad, point.y + pad]
			],
			{ layers: ids }
		);
		return hits.find((hit) => hit.id !== undefined) ?? null;
	}

	/** The location bubble or dot under the pointer. */
	function pointAt(point: maplibregl.Point) {
		if (!map) return null;
		const ids = [SERVER_CLUSTER_LAYER, CLUSTER_LAYER, DOT_LAYER].filter((id) => map!.getLayer(id));
		if (ids.length === 0) return null;
		return map.queryRenderedFeatures(point, { layers: ids })[0] ?? null;
	}

	function clearLayerHover() {
		setFeatureFlag(layerHovered, 'hover', false);
		layerHovered = null;
		hoverPopup?.remove();
	}

	function clearLayerSelection() {
		const open = detailPopup;
		detailPopup = undefined;
		open?.remove();
		setFeatureFlag(layerSelected, 'selected', false);
		layerSelected = null;
	}

	/** One property value as text, cut short so a huge value cannot flood the popup. */
	function valueText(value: unknown) {
		const text = typeof value === 'string' ? value : JSON.stringify(value);
		return text.length > 200 ? `${text.slice(0, 200)}...` : text;
	}

	function shapeDetails(layerName: string, properties: Record<string, unknown>) {
		// Built from text nodes, never HTML: the values come from an uploaded file.
		const root = document.createElement('div');
		root.className = 'text-sm';
		const title = document.createElement('p');
		title.className = 'font-semibold mb-1 pr-6';
		title.textContent = layerName;
		root.append(title);

		const entries = Object.entries(properties);
		if (entries.length === 0) {
			const empty = document.createElement('p');
			empty.className = 'text-on-surface-subtle';
			empty.textContent = 'This shape has no properties.';
			root.append(empty);
			return root;
		}
		const list = document.createElement('dl');
		list.className = 'grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 max-h-60 overflow-y-auto';
		for (const [key, value] of entries.slice(0, 30)) {
			const term = document.createElement('dt');
			term.className = 'text-on-surface-subtle';
			term.textContent = key;
			const detail = document.createElement('dd');
			detail.className = 'break-words';
			detail.textContent = valueText(value);
			list.append(term, detail);
		}
		root.append(list);
		return root;
	}

	function onMapMove(event: maplibregl.MapMouseEvent) {
		if (!map || pinDropMode) return;
		const overPoint = !!pointAt(event.point);
		const shape = !overPoint && layerDetails ? shapeAt(event.point) : null;
		map.getCanvas().style.cursor = overPoint || shape ? 'pointer' : '';

		const next: FeatureRef | null = shape ? { source: shape.source, id: shape.id! } : null;
		if (!sameFeature(next, layerHovered)) {
			setFeatureFlag(layerHovered, 'hover', false);
			layerHovered = next;
			setFeatureFlag(layerHovered, 'hover', true);
		}
		if (!shape || !next) {
			hoverPopup?.remove();
			return;
		}
		const layer = layerForSource(next.source);
		const labelValue = layer?.labelField ? shape.properties?.[layer.labelField] : null;
		const text = labelValue !== null && labelValue !== undefined ? String(labelValue) : (layer?.name ?? '');
		hoverPopup?.setLngLat(event.lngLat).setText(text).addTo(map);
	}

	async function onMapClick(event: maplibregl.MapMouseEvent) {
		if (!map || pinDropMode) return;
		const point = pointAt(event.point);

		if (point?.properties?.server_cluster) {
			// The server has no expansion zoom to ask for, so step in two levels on the bubble.
			const [lng, lat] = (point.geometry as GeoJSON.Point).coordinates;
			map.easeTo({ center: [lng, lat], zoom: Math.min(map.getZoom() + 2, 20) });
			return;
		}
		if (point?.properties?.cluster) {
			// Zoom to where the bubble splits apart.
			const source = map.getSource(POINT_SOURCE) as maplibregl.GeoJSONSource;
			const zoom = await source.getClusterExpansionZoom(point.properties.cluster_id);
			const [lng, lat] = (point.geometry as GeoJSON.Point).coordinates;
			map?.easeTo({ center: [lng, lat], zoom });
			return;
		}
		if (point) {
			const loc = locationsById.get(String(point.properties?.id));
			if (loc) selectLocation(loc);
			return;
		}

		clearLayerSelection();
		if (!layerDetails) return;
		const shape = shapeAt(event.point);
		if (!shape) return;

		layerSelected = { source: shape.source, id: shape.id! };
		setFeatureFlag(layerSelected, 'selected', true);
		const layer = layerForSource(shape.source);
		const opened = new maplibregl.Popup({ closeOnClick: false, maxWidth: '300px', offset: 8 })
			.setLngLat(event.lngLat)
			.setDOMContent(shapeDetails(layer?.name ?? 'Layer', shape.properties ?? {}))
			.addTo(map);
		opened.on('close', () => {
			if (detailPopup === opened) clearLayerSelection();
		});
		detailPopup = opened;
	}

	function onMapLeave() {
		clearLayerHover();
		if (map) map.getCanvas().style.cursor = '';
	}

	// ---------------------------------------------------------------- Pin drop, draft, handle, viewer

	// Pin drop: a plain map click reports coordinates instead of selecting anything.
	$effect(() => {
		if (!mapReady || !map || !pinDropMode) return;

		const canvas = map.getCanvas();
		canvas.style.cursor = 'crosshair';
		untrack(clearLayerHover);

		const handler = (e: maplibregl.MapMouseEvent) => {
			onPinDrop?.({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
		};
		map.on('click', handler);

		return () => {
			map?.off('click', handler);
			canvas.style.cursor = '';
		};
	});

	let draftMarker: maplibregl.Marker | undefined;

	$effect(() => {
		if (!mapReady || !map) return;
		const pin = draftPin;

		if (!pin) {
			draftMarker?.remove();
			draftMarker = undefined;
			return;
		}
		if (draftMarker) {
			draftMarker.setLngLat([pin.longitude, pin.latitude]);
			return;
		}

		const element = document.createElement('div');
		element.dataset.testid = 'draft-pin';
		// Drawn selected so it reads as the one being worked on.
		mount(MapMarker, { target: element, props: { variant: 'unvisited', isSelected: true } });

		const marker = new maplibregl.Marker({ element, anchor: 'bottom', draggable: true })
			.setLngLat([pin.longitude, pin.latitude])
			.addTo(map);
		marker.on('dragend', () => {
			const { lng, lat } = marker.getLngLat();
			onDraftMove?.({ latitude: lat, longitude: lng });
		});
		draftMarker = marker;
	});

	let handleMarker: maplibregl.Marker | undefined;

	$effect(() => {
		if (!mapReady || !map) return;
		const grip = handle;

		if (!grip) {
			handleMarker?.remove();
			handleMarker = undefined;
			return;
		}
		if (handleMarker) {
			handleMarker.setLngLat([grip.longitude, grip.latitude]);
			return;
		}

		const element = document.createElement('div');
		element.dataset.testid = 'map-handle';
		element.setAttribute('aria-label', 'Drag to resize');
		element.style.cssText =
			'width:18px;height:18px;border-radius:9999px;background:#fff;border:3px solid #10b981;box-shadow:0 1px 3px rgba(0,0,0,.4);cursor:grab;';

		const marker = new maplibregl.Marker({ element, anchor: 'center', draggable: true })
			.setLngLat([grip.longitude, grip.latitude])
			.addTo(map);
		marker.on('drag', () => {
			const { lng, lat } = marker.getLngLat();
			onHandleDrag?.({ latitude: lat, longitude: lng });
		});
		handleMarker = marker;
	});

	let userMarker: maplibregl.Marker | undefined;

	$effect(() => {
		if (!mapReady || !map) return;
		const position = userPosition;

		if (!position) {
			userMarker?.remove();
			userMarker = undefined;
			return;
		}
		if (userMarker) {
			userMarker.setLngLat([position.longitude, position.latitude]);
			return;
		}

		const element = document.createElement('div');
		element.className = 'map-view-user-dot';
		element.dataset.testid = 'user-position';
		userMarker = new maplibregl.Marker({ element, anchor: 'center' })
			.setLngLat([position.longitude, position.latitude])
			.addTo(map);
	});

	// ---------------------------------------------------------------- Turf outline

	const BOUNDS_SOURCE = 'mv-bounds';
	const BOUNDS_FILL = 'mv-bounds-fill';
	const BOUNDS_LINE = 'mv-bounds-line';

	$effect(() => {
		const geometry = boundsGeoJSON;
		void styleVersion;
		if (!mapReady || !map) return;

		untrack(() => {
			const current = map!;
			if (!geometry) {
				if (!added.has(BOUNDS_SOURCE)) return;
				if (current.getLayer(BOUNDS_FILL)) current.removeLayer(BOUNDS_FILL);
				if (current.getLayer(BOUNDS_LINE)) current.removeLayer(BOUNDS_LINE);
				current.removeSource(BOUNDS_SOURCE);
				added.delete(BOUNDS_SOURCE);
				return;
			}

			const data = { type: 'Feature' as const, properties: {}, geometry };
			if (added.has(BOUNDS_SOURCE)) {
				(current.getSource(BOUNDS_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(data);
				return;
			}
			current.addSource(BOUNDS_SOURCE, { type: 'geojson', data });
			added.add(BOUNDS_SOURCE);
			current.addLayer(
				{
					id: BOUNDS_FILL,
					type: 'fill',
					source: BOUNDS_SOURCE,
					paint: { 'fill-color': '#10b981', 'fill-opacity': 0.08 }
				},
				beneathPoints()
			);
			current.addLayer(
				{
					id: BOUNDS_LINE,
					type: 'line',
					source: BOUNDS_SOURCE,
					paint: { 'line-color': '#10b981', 'line-width': 2, 'line-dasharray': [2, 1] }
				},
				beneathPoints()
			);
		});
	});

	// ---------------------------------------------------------------- Theme

	// Swap the base style when the site theme changes. Reading themeStore.theme
	// subscribes the effect; the resolved light/dark value comes from the DOM so
	// that 'system' follows the media query.
	$effect(() => {
		const dark = themeStore.theme === 'dark' || (themeStore.theme !== 'light' && isDarkTheme());
		if (!map) return;
		// A full reload rather than a diff, so 'style.load' fires and everything is drawn again.
		getMapStyle(dark).then((style) => map?.setStyle(style as never, { diff: false }));
	});

	// ---------------------------------------------------------------- Exported controls

	/** Pans the map to an arbitrary point, for callers driving their own controls. */
	export function panTo(coords: { latitude: number; longitude: number }, zoom = 18) {
		map?.flyTo({ center: [coords.longitude, coords.latitude], zoom });
	}

	/** Pans the map to a location, selects it, and opens its popup. */
	export function flyToLocation(id: string) {
		const loc = locationsById.get(id);
		if (!loc || !map) return;

		closePopup();
		selectedLocationId = id;
		map.flyTo({ center: [loc.longitude, loc.latitude], zoom: 18 });
		map.once('moveend', () => openPopup(loc));
	}

	/** Fits the map to a GeoJSON object, such as a layer that was just added. */
	export function fitGeoJSON(
		geojson: LayerGeoJSON,
		padding: number | { top: number; bottom: number; left: number; right: number } = 60
	) {
		const bounds = geojsonBounds(geojson);
		if (!map || !bounds) return;
		map.fitBounds(
			[
				[bounds[0], bounds[1]],
				[bounds[2], bounds[3]]
			],
			{ padding, maxZoom: 16, duration: 600 }
		);
	}

	// ---------------------------------------------------------------- Setup

	onMount(() => {
		(async () => {
			const style = await getMapStyle(isDarkTheme());
			// The component can unmount while the style loads.
			if (!mapContainer) return;

			map = new maplibregl.Map({
				container: mapContainer,
				style: style as never,
				...(initialBounds
					? {
							bounds: toLngLatBounds(initialBounds),
							fitBoundsOptions: { padding: 60, maxZoom: 16 }
						}
					: locations.length > 0
						? {
								bounds: locationBounds(locations),
								fitBoundsOptions: { padding: 60, maxZoom: 16 }
							}
						: { center: defaultCenter, zoom: defaultZoom }),
				attributionControl: { compact: true }
			});
			// The opening view already fits the locations; only a later change refits.
			fittedSignature = locationSignature;

			if (geolocate) {
				map.addControl(
					new maplibregl.GeolocateControl({
						positionOptions: { enableHighAccuracy: true },
						trackUserLocation: true,
						showUserLocation: true,
						showAccuracyCircle: true,
						fitBoundsOptions: { zoom: 18 }
					})
				);
			}

			hoverPopup = new maplibregl.Popup({
				closeButton: false,
				closeOnClick: false,
				className: 'map-view-tooltip',
				offset: 14
			});

			map.on('dataloading', () => {
				mapLoading = true;
				mapLoadingComplete = false;
				tilesTotal = 0;
				tilesLoaded = 0;
			});
			map.on('sourcedataloading', (e) => {
				if (e.tile) tilesTotal++;
			});
			map.on('sourcedata', (e) => {
				if (e.tile) tilesLoaded++;
				// The clustered source has finished placing points: give the single ones pins.
				if (e.sourceId === POINT_SOURCE && e.isSourceLoaded) syncPins();
			});
			map.on('idle', () => {
				mapLoading = false;
				mapLoadingComplete = true;
			});

			map.on('style.load', () => {
				// Runtime sources and layers went with the old style.
				added.clear();
				drawnLayers.clear();
				pointConfig = null;
				drawnSelection = null;
				layerHovered = null;
				layerSelected = null;
				hoverPopup?.remove();
				clearLayerSelection();
				styleVersion++;
			});
			map.on('load', () => {
				mapReady = true;
				reportViewport();
			});

			// moveend rather than move: one fetch when the organizer stops, not one
			// per animation frame while they are still dragging.
			map.on('moveend', () => {
				syncPins();
				reportViewport();
			});
			map.on('mousemove', onMapMove);
			map.on('mouseout', onMapLeave);
			map.on('click', onMapClick);
		})();

		return () => {
			closePopup();
			clearPins();
			map?.remove();
			map = undefined;
		};
	});

	/** What the loading indicator says once everything has loaded. */
	const loadedLabel = $derived.by(() => {
		if (locations.length > 0) return `${locations.length} location${locations.length === 1 ? '' : 's'} loaded`;
		const shown = showLayers ? layers.length : 0;
		if (shown > 0) return `${shown} layer${shown === 1 ? '' : 's'} loaded`;
		return 'Map loaded';
	});
</script>

<!-- The container pair is positioned with inline styles because maplibre's own
     stylesheet sets .maplibregl-map to position: relative, which overrides a
     Tailwind class of equal specificity and collapses the map to zero height. -->
<div class={className} style="position: relative;">
	<div bind:this={mapContainer} style="position: absolute; inset: 0;" data-testid="map-view"></div>

	{#if mapLoading || mapLoadingComplete || locationsLoading}
		<div class="absolute bottom-3 left-3 flex flex-col items-start gap-1 z-20 pointer-events-none">
			<progress
				value={mapLoadingComplete && !locationsLoading ? 1 : tilesLoaded}
				max={mapLoadingComplete && !locationsLoading ? 1 : tilesTotal || 1}
				class:complete={mapLoadingComplete && !locationsLoading}
			></progress>
			<span class="relative flex h-4">
				{#if mapLoading || locationsLoading}
					<span class="indicator-content" out:fade={{ duration: 300 }}>
						<Spinner size={12} />
						<span class="loading-label">
							{#if mapLoading && locationsLoading}
								Loading map and locations...
							{:else if mapLoading}
								Loading map tiles...
							{:else}
								Loading locations...
							{/if}
						</span>
					</span>
				{:else}
					<span class="indicator-content" in:fade={{ duration: 300, delay: 150 }}>
						<SmileyIcon weight="fill" size={12} />
						{loadedLabel}
					</span>
				{/if}
			</span>
		</div>
	{/if}

	{#if layerToggles && layers.length > 0}
		<!-- Pinned to the top and bottom so the open list can shrink to the map and scroll. -->
		<div class="pointer-events-none absolute top-2.5 right-2.5 bottom-2.5 z-10 flex flex-col items-end">
			<MapLayerToggles
				{layers}
				isOn={isLayerOn}
				isLoading={(layer) => !!fetching[layer.id]}
				onToggle={(ids, on) => {
					for (const id of ids) toggled[id] = on;
				}}
			/>
		</div>
	{/if}

	{#if children}
		{@render children()}
	{/if}
</div>

<style>
	/* The viewer's own position. Global because the element is created
	   imperatively and handed to maplibre, so it is outside this component's
	   scoped-style tree. */
	:global(.map-view-user-dot) {
		background-color: var(--primary);
		border-radius: 50%;
		height: 15px;
		width: 15px;
		position: relative;
	}
	:global(.map-view-user-dot::before) {
		animation: map-view-user-dot-pulse 2s infinite;
		background-color: var(--primary);
		border-radius: 50%;
		content: '';
		height: 15px;
		width: 15px;
		position: absolute;
	}
	/* The ring is a contrast device against the map tiles rather than a brand
	   colour, so it stays white in both themes. */
	:global(.map-view-user-dot::after) {
		border: 2px solid #fff;
		border-radius: 50%;
		box-shadow: 0 0 3px rgba(0, 0, 0, 0.35);
		box-sizing: border-box;
		content: '';
		height: 19px;
		left: -2px;
		position: absolute;
		top: -2px;
		width: 19px;
	}

	@keyframes map-view-user-dot-pulse {
		0% {
			opacity: 1;
			transform: scale(1);
		}
		70% {
			opacity: 0;
			transform: scale(3);
		}
		100% {
			opacity: 0;
			transform: scale(3);
		}
	}

	:global(.maplibregl-popup) {
		font-family: inherit;
	}

	:global(.maplibregl-popup-content) {
		background-color: var(--surface);
		color: var(--on-surface);
		border-radius: 0.75rem;
		box-shadow:
			0 10px 15px -3px rgb(0 0 0 / 0.1),
			0 4px 6px -4px rgb(0 0 0 / 0.1);
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		border: 1px solid var(--outline-subtle);
	}

	/* The hover label on a layer shape: plain text that never takes the pointer. */
	:global(.map-view-tooltip) {
		pointer-events: none;
	}
	:global(.map-view-tooltip .maplibregl-popup-content) {
		padding: 0.375rem 0.625rem;
		border-radius: 0.5rem;
	}
	:global(.map-view-tooltip .maplibregl-popup-tip) {
		display: none;
	}

	:global(.maplibregl-popup-close-button) {
		color: var(--on-surface-subtle);
		font-size: 0;
		aspect-ratio: 1;
		padding: 0;
		width: 2rem;
		border-radius: 0.375rem;
		margin: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	:global(.maplibregl-popup-close-button::after) {
		content: '';
		display: block;
		width: 0.75rem;
		height: 0.75rem;
		background-color: currentColor;
		mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath d='M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z'/%3E%3C/svg%3E");
		mask-size: contain;
		mask-repeat: no-repeat;
		mask-position: center;
	}

	:global(.maplibregl-popup-close-button:focus:not(:focus-visible)) {
		outline: none;
	}

	:global(.maplibregl-popup-close-button:hover) {
		background-color: var(--surface-container);
		color: var(--on-surface);
	}

	:global(.maplibregl-popup-anchor-bottom .maplibregl-popup-tip) {
		border-top-color: var(--surface);
	}
	:global(.maplibregl-popup-anchor-top .maplibregl-popup-tip) {
		border-bottom-color: var(--surface);
	}
	:global(.maplibregl-popup-anchor-left .maplibregl-popup-tip) {
		border-right-color: var(--surface);
	}
	:global(.maplibregl-popup-anchor-right .maplibregl-popup-tip) {
		border-left-color: var(--surface);
	}
	:global(.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip),
	:global(.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip) {
		border-top-color: var(--surface);
	}
	:global(.maplibregl-popup-anchor-top-left .maplibregl-popup-tip),
	:global(.maplibregl-popup-anchor-top-right .maplibregl-popup-tip) {
		border-bottom-color: var(--surface);
	}

	progress {
		display: block;
		width: 200px;
		height: 5px;
		border-radius: 3px;
		border: none;
		overflow: hidden;
		appearance: none;
		background-color: rgb(0 0 0 / 0.15);
	}

	progress::-webkit-progress-bar {
		background-color: rgb(0 0 0 / 0.15);
		border-radius: 3px;
	}
	progress::-webkit-progress-value {
		background-color: var(--primary);
		border-radius: 3px;
	}
	progress::-moz-progress-bar {
		background-color: var(--primary);
		border-radius: 3px;
	}
	progress.complete::-webkit-progress-value {
		background-color: rgb(0 0 0 / 0.25);
	}
	progress.complete::-moz-progress-bar {
		background-color: rgb(0 0 0 / 0.25);
	}

	:global([data-theme='dark']) progress {
		background-color: rgb(255 255 255 / 0.2);
	}
	:global([data-theme='dark']) progress::-webkit-progress-bar {
		background-color: rgb(255 255 255 / 0.2);
	}
	:global([data-theme='dark']) progress.complete::-webkit-progress-value {
		background-color: rgb(255 255 255 / 0.3);
	}
	:global([data-theme='dark']) progress.complete::-moz-progress-bar {
		background-color: rgb(255 255 255 / 0.3);
	}

	.indicator-content {
		position: absolute;
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 4px;
		font-size: 0.625rem;
		color: rgb(0 0 0 / 0.45);
		letter-spacing: 0.01em;
		white-space: nowrap;
	}

	:global([data-theme='dark']) .indicator-content {
		color: rgb(255 255 255 / 0.55);
	}

	.loading-label {
		background: linear-gradient(
			90deg,
			rgb(0 0 0 / 0.25),
			rgb(0 0 0 / 0.55),
			rgb(0 0 0 / 0.35),
			rgb(0 0 0 / 0.6),
			rgb(0 0 0 / 0.2),
			rgb(0 0 0 / 0.55),
			rgb(0 0 0 / 0.25)
		);
		background-size: 300%;
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		animation: shimmer-sweep 8s linear infinite;
	}

	:global([data-theme='dark']) .loading-label {
		background: linear-gradient(
			90deg,
			rgb(255 255 255 / 0.25),
			rgb(255 255 255 / 0.65),
			rgb(255 255 255 / 0.35),
			rgb(255 255 255 / 0.7),
			rgb(255 255 255 / 0.2),
			rgb(255 255 255 / 0.65),
			rgb(255 255 255 / 0.25)
		);
		background-size: 300%;
		-webkit-background-clip: text;
		background-clip: text;
	}

	@keyframes shimmer-sweep {
		from {
			background-position: 0%;
		}
		to {
			background-position: 300%;
		}
	}
</style>
