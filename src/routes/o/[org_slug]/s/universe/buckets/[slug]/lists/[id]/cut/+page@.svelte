<script lang="ts">
	type ListLocation = {
		record_id: string;
		record_source: string;
		name: string | null;
		address_line_1: string | null;
		city: string | null;
		state_or_region: string | null;
		postal_code: string | null;
		latitude: number;
		longitude: number;
	};

	import { mount, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import maplibregl from 'maplibre-gl';
	import Button from '$components/actions/button/Button.svelte';
	import { themeStore } from '$lib/theme.svelte';
	import { getMapStyle } from '$lib/map-style';
	import MapMarker from '$components/data-display/map-marker/MapMarker.svelte';
	import MapPopup from '$components/data-display/map-popup/MapPopup.svelte';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeft';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRight';
	import SidebarIcon from 'phosphor-svelte/lib/Sidebar';
	import Spinner from '$components/feedback/spinner/Spinner.svelte';
	import SmileyIcon from 'phosphor-svelte/lib/Smiley';

	import '@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css';
	import type { Geoman } from '@geoman-io/maplibre-geoman-free';

	let { data } = $props();

	const { org_slug } = $page.params;
	const listHref = $derived(`/o/${org_slug}/s/universe/buckets/${data.bucketSlug}/lists/${data.listId}`);

	let mapContainer: HTMLDivElement;
	const DEFAULT_ZOOM = 12;
	const PAGE_SIZE = 25;

	let map: maplibregl.Map;
	let locations: ListLocation[] = $state([]);
	let markers: { id: string; marker: maplibregl.Marker }[] = [];
	let geoman: Geoman | undefined;
	let selectedLocationId = $state<string | null>(null);

	let storedSurveySelection = $state<{ surveyId: string; scriptId: string | null; expiresAt: string } | null>(null);
	let sidebarOpen = $state(true);
	let currentPage = $state(0);
	let activeTab = $state<'locations' | 'turfs'>('locations');

	let mapLoading = $state(false);
	let mapLoadingComplete = $state(false);
	let locationsLoading = $state(true);
	let locationsError = $state<string | null>(null);
	let tilesTotal = $state(0);
	let tilesLoaded = $state(0);
	let totalPages = $derived(Math.max(1, Math.ceil(locations.length / PAGE_SIZE)));
	let pagedLocations = $derived(
		locations.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
	);

	type ExistingTurf = {
		id: string;
		code: string;
		expires_at: string;
		bounds: string | null;
	};

	let existingTurfs = $state<ExistingTurf[]>([]);
	let turfFeatures = $state<any[]>([]);

	function updateTurfFeatures() {
		if (!geoman) return;
		const all = (geoman as Geoman).features.getAll();
		turfFeatures = JSON.parse(JSON.stringify(all.features));
	}

	function pointInPolygon(point: [number, number], ring: [number, number][]): boolean {
		const [px, py] = point;
		let inside = false;
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const [xi, yi] = ring[i];
			const [xj, yj] = ring[j];
			if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
				inside = !inside;
			}
		}
		return inside;
	}

	let turfItems = $derived(
		turfFeatures.map((feature, index) => {
			const coords = feature.geometry?.coordinates;
			const ring: [number, number][] =
				feature.geometry?.type === 'MultiPolygon' ? (coords?.[0]?.[0] ?? []) : (coords?.[0] ?? []);
			const inside = locations.filter((loc) => pointInPolygon([loc.longitude, loc.latitude], ring));
			return { index: index + 1, inside };
		})
	);

	let hoveredTurfIndex = $state<number | null>(null);
	let activeSidebarTurfIndex = $state<number | null>(null);
	let highlightedTurfIndex = $derived(hoveredTurfIndex ?? activeSidebarTurfIndex);
	let hoverPopup: maplibregl.Popup;

	function polygonCentroid(ring: [number, number][]): [number, number] {
		let cx = 0, cy = 0, area = 0;
		const n = ring.length;
		for (let i = 0; i < n; i++) {
			const [x1, y1] = ring[i];
			const [x2, y2] = ring[(i + 1) % n];
			const a = x1 * y2 - x2 * y1;
			area += a;
			cx += (x1 + x2) * a;
			cy += (y1 + y2) * a;
		}
		area /= 2;
		if (Math.abs(area) < 1e-12) {
			// degenerate polygon — fall back to coordinate average
			const sumX = ring.reduce((s, p) => s + p[0], 0);
			const sumY = ring.reduce((s, p) => s + p[1], 0);
			return [sumX / n, sumY / n];
		}
		return [cx / (6 * area), cy / (6 * area)];
	}

	// Existing turfs are rendered in a separate MapLibre source that Geoman has no
	// knowledge of. Geoman's delete/edit tools only operate on features in its own
	// internal collection, so these polygons cannot be accidentally removed.
	function addExistingTurfLayers() {
		if (!map.getSource('existing-turfs')) {
			map.addSource('existing-turfs', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});
		}
		if (!map.getLayer('existing-turfs-fill')) {
			map.addLayer({
				id: 'existing-turfs-fill',
				type: 'fill',
				source: 'existing-turfs',
				paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.12 }
			});
		}
		if (!map.getLayer('existing-turfs-outline')) {
			map.addLayer({
				id: 'existing-turfs-outline',
				type: 'line',
				source: 'existing-turfs',
				paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-opacity': 0.7 }
			});
		}
		if (!map.getLayer('existing-turfs-labels')) {
			map.addLayer({
				id: 'existing-turfs-labels',
				type: 'symbol',
				source: 'existing-turfs',
				layout: {
					'text-field': ['get', 'code'],
					'text-font': ['Noto Sans Bold'],
					'text-size': 11,
					'text-anchor': 'center',
					'text-allow-overlap': false
				},
				paint: {
					'text-color': '#1d4ed8',
					'text-halo-color': '#ffffff',
					'text-halo-width': 3
				}
			});
		}
	}

	async function loadExistingTurfs() {
		try {
			const res = await fetch(`/o/${org_slug}/s/api/universe/lists/${data.listId}/turfs`);
			if (!res.ok) return;
			const turfs: ExistingTurf[] = await res.json();
			existingTurfs = turfs.filter((t) => t.bounds);

			const source = map.getSource('existing-turfs') as maplibregl.GeoJSONSource | undefined;
			if (!source) return;

			source.setData({
				type: 'FeatureCollection',
				features: existingTurfs.map((t) => ({
					type: 'Feature' as const,
					geometry: JSON.parse(t.bounds!),
					properties: { code: t.code }
				}))
			});
		} catch {
			// non-critical — existing turfs are display-only
		}
	}

	function addHighlightLayers() {
		if (!map.getSource('turf-highlight')) {
			map.addSource('turf-highlight', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});
		}
		if (!map.getLayer('turf-highlight-fill')) {
			map.addLayer({
				id: 'turf-highlight-fill',
				type: 'fill',
				source: 'turf-highlight',
				paint: { 'fill-color': '#10b981', 'fill-opacity': 0.22 }
			});
		}
		if (!map.getLayer('turf-highlight-outline')) {
			map.addLayer({
				id: 'turf-highlight-outline',
				type: 'line',
				source: 'turf-highlight',
				paint: { 'line-color': '#10b981', 'line-width': 3, 'line-opacity': 0.9 }
			});
		}
		if (!map.getSource('turf-labels')) {
			map.addSource('turf-labels', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});
		}
		if (!map.getLayer('turf-labels-layer')) {
			map.addLayer({
				id: 'turf-labels-layer',
				type: 'symbol',
				source: 'turf-labels',
				layout: {
					'text-field': ['get', 'label'],
					'text-font': ['Noto Sans Bold'],
					'text-size': 13,
					'text-anchor': 'center',
					'text-allow-overlap': false
				},
				paint: {
					'text-color': '#000000',
					'text-halo-color': '#ffffff',
					'text-halo-width': 4
				}
			});
		}
	}

	$effect(() => {
		const idx = highlightedTurfIndex;
		const _ = turfFeatures;
		if (!map) return;
		const source = map.getSource('turf-highlight') as maplibregl.GeoJSONSource | undefined;
		if (!source) return;
		if (idx === null) {
			source.setData({ type: 'FeatureCollection', features: [] });
			return;
		}
		const feature = turfFeatures[idx - 1];
		source.setData({ type: 'FeatureCollection', features: feature ? [feature] : [] });
	});

	$effect(() => {
		const tab = activeTab;
		const features = turfFeatures;
		if (!map) return;
		const source = map.getSource('turf-labels') as maplibregl.GeoJSONSource | undefined;
		if (!source) return;
		if (tab !== 'turfs') {
			source.setData({ type: 'FeatureCollection', features: [] });
			return;
		}
		const labelFeatures = features.map((feature, index) => {
			const coords = feature.geometry?.coordinates;
			const ring: [number, number][] =
				feature.geometry?.type === 'MultiPolygon' ? (coords?.[0]?.[0] ?? []) : (coords?.[0] ?? []);
			const center = polygonCentroid(ring);
			return {
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: center },
				properties: { label: `Turf ${index + 1}` }
			};
		});
		source.setData({ type: 'FeatureCollection', features: labelFeatures });
	});

	function isDarkTheme() {
		return document.documentElement.getAttribute('data-theme') === 'dark';
	}

	$effect(() => {
		const _ = themeStore.theme;
		if (map) {
			//@ts-ignore
			getMapStyle(isDarkTheme()).then((style) => map.setStyle(style));
		}
	});

	function locationLabel(loc: ListLocation): string {
		return loc.name ?? loc.address_line_1 ?? 'Unknown';
	}

	function createMarker(loc: ListLocation) {
		const element = document.createElement('div');

		element.addEventListener('click', () => {
			selectedLocationId = loc.record_id;
		});

		mount(MapMarker, {
			target: element,
			props: {
				variant: 'unvisited',
				get isSelected() {
					return selectedLocationId === loc.record_id;
				}
			}
		});

		const popupEl = document.createElement('div');
		mount(MapPopup, {
			target: popupEl,
			props: {
				locationName: loc.name ?? loc.address_line_1 ?? '',
				street: loc.address_line_1,
				locality: loc.city
			}
		});

		const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
			.setLngLat([loc.longitude, loc.latitude])
			.setPopup(new maplibregl.Popup({ offset: 34 }).setDOMContent(popupEl))
			.addTo(map);

		markers.push({ id: loc.record_id, marker });
	}

	async function loadListLocations() {
		locationsLoading = true;
		locationsError = null;
		try {
			const response = await fetch(
				`/o/${org_slug}/s/api/universe/lists/${data.listId}/locations`
			);
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				locationsError = body.error ?? `Failed to load locations (${response.status})`;
				return;
			}
			const data_: ListLocation[] = await response.json();

			if (data_.length === 0) {
				locationsError = 'No locations in this list have coordinates. Re-import your data with latitude and longitude columns to use the turf cutter.';
				return;
			}

			locations = data_;
			currentPage = 0;

			for (const loc of locations) {
				createMarker(loc);
			}
		} finally {
			locationsLoading = false;
		}
	}

	function flyToLocation(loc: ListLocation) {
		markers.forEach(({ marker }) => {
			if (marker.getPopup()?.isOpen()) marker.togglePopup();
		});

		selectedLocationId = loc.record_id;
		map.flyTo({ center: [loc.longitude, loc.latitude], zoom: 18 });

		const entry = markers.find((m) => m.id === loc.record_id);
		if (entry) {
			map.once('moveend', () => entry.marker.togglePopup());
		}
	}

	async function saveTurfs() {
		if (!geoman || !storedSurveySelection) return;

		const features = (geoman as Geoman).features;
		const polygons = features.getAll().features.map((feature) => ({
			code: null,
			geometry: feature.geometry
		}));

		if (polygons.length === 0) return;

		const response = await fetch(`/o/${org_slug}/s/api/turf/create`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				polygons,
				survey_id: storedSurveySelection.surveyId,
				script_id: storedSurveySelection.scriptId ?? null,
				expires_at: storedSurveySelection.expiresAt,
				list_id: data.listId,
				bucket_id: data.bucketId
			})
		});

		if (response.ok) {
			sessionStorage.removeItem('universe_cut_survey_selection');
			await goto(listHref);
		}
	}

	async function fetchInitialBounds(): Promise<maplibregl.LngLatBounds | null> {
		try {
			const res = await fetch(`/o/${org_slug}/s/api/universe/lists/${data.listId}/locations`);
			if (!res.ok) return null;
			const locs: ListLocation[] = await res.json();
			if (locs.length === 0) return null;
			return locs.reduce(
				(b, l) => b.extend([l.longitude, l.latitude]),
				new maplibregl.LngLatBounds([locs[0].longitude, locs[0].latitude], [locs[0].longitude, locs[0].latitude])
			);
		} catch {
			return null;
		}
	}

	onMount(() => {
		const stored = sessionStorage.getItem('universe_cut_survey_selection');
		if (stored) {
			storedSurveySelection = JSON.parse(stored);
		} else {
			goto(listHref);
		}

		(async () => {
			const [{ Geoman }, style, initialBounds] = await Promise.all([
				import('@geoman-io/maplibre-geoman-free'),
				getMapStyle(isDarkTheme()),
				fetchInitialBounds()
			]);
			await import('@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css');

			map = new maplibregl.Map({
				container: mapContainer,
				//@ts-ignore
				style,
				...(initialBounds
					? { bounds: initialBounds, fitBoundsOptions: { padding: 60, maxZoom: 16 } }
					: { center: [-75.2238, 40.0259], zoom: DEFAULT_ZOOM }),
				attributionControl: { compact: true }
			});

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

			(['gm:create', 'gm:edit', 'gm:remove', 'gm:change'] as const).forEach((evt) => {
				map.on(evt as any, () => queueMicrotask(updateTurfFeatures));
			});

			hoverPopup = new maplibregl.Popup({
				closeButton: false,
				closeOnClick: false,
				className: 'turf-name-tooltip',
				offset: [0, -6]
			});

			map.on('style.load', () => {
				addExistingTurfLayers();
				addHighlightLayers();
			});

			map.on('mousemove', (e) => {
				if (turfFeatures.length === 0) return;
				const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
				let found: number | null = null;
				for (let i = 0; i < turfFeatures.length; i++) {
					const f = turfFeatures[i];
					const coords = f.geometry?.coordinates;
					const ring: [number, number][] =
						f.geometry?.type === 'MultiPolygon' ? (coords?.[0]?.[0] ?? []) : (coords?.[0] ?? []);
					if (pointInPolygon(pt, ring)) { found = i + 1; break; }
				}
				if (found !== null) {
					hoveredTurfIndex = found;
					hoverPopup.setLngLat(e.lngLat).setHTML(`Turf ${found}`).addTo(map);
				} else {
					hoveredTurfIndex = null;
					hoverPopup.remove();
				}
			});

			map.getCanvas().addEventListener('mouseleave', () => {
				hoveredTurfIndex = null;
				hoverPopup?.remove();
			});

			map.on('load', () => {
				addExistingTurfLayers();
				addHighlightLayers();
				loadListLocations();
				loadExistingTurfs();
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
			});
			map.on('idle', () => {
				mapLoading = false;
				mapLoadingComplete = true;
			});
		})();

		return () => {
			if (map) map.remove();
		};
	});
</script>

<div class="relative" style="--sidebar-w: {sidebarOpen ? '300px' : '56px'}">
	<div bind:this={mapContainer} class="w-screen h-screen"></div>

	<div class="absolute top-2.5 left-2.5 flex gap-2 items-center">
		<Button variant="outline" href={listHref} class="!bg-surface">← Back to List</Button>
		<Button onclick={saveTurfs} disabled={turfFeatures.length === 0 || !storedSurveySelection}>Save Turfs</Button>
	</div>

	<div class="absolute top-2.5 left-1/2 -translate-x-1/2 bg-surface border border-outline-subtle rounded-lg px-3 py-1.5 text-sm text-on-surface-subtle shadow-sm">
		{data.listName}
	</div>

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
						{locations.length} locations loaded
					</span>
				{/if}
			</span>
		</div>
	{/if}

	<div
		class="absolute top-2.5 right-2.5 bg-surface border border-outline-subtle rounded-xl shadow-md flex flex-col overflow-hidden z-10
		       {sidebarOpen ? 'bottom-2.5 w-[280px]' : 'w-auto'}"
	>
		<div
			class="flex items-center justify-between p-2 gap-2 shrink-0
			       {sidebarOpen ? 'border-b border-outline-subtle' : ''}"
		>
			{#if sidebarOpen}
				<span class="text-sm font-semibold text-on-surface">List Locations</span>
			{/if}
			<button
				class="text-on-surface-subtle flex items-center justify-center w-8 h-8 rounded-md shrink-0 cursor-pointer hover:bg-surface-container hover:text-on-surface focus:outline-none"
				onclick={() => (sidebarOpen = !sidebarOpen)}
				aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
			>
				<SidebarIcon size={18} />
			</button>
		</div>

		{#if sidebarOpen}
			<div class="flex border-b border-outline-subtle shrink-0">
				<button
					class="flex-1 px-2 py-2 text-[13px] font-medium cursor-pointer border-b-2 -mb-px transition-colors duration-150 focus:outline-none
					       {activeTab === 'locations'
						? 'text-primary border-primary'
						: 'text-on-surface-subtle border-transparent hover:text-on-surface'}"
					onclick={() => (activeTab = 'locations')}
				>
					Locations <span class="font-normal text-on-surface-subtle">({locations.length})</span>
				</button>
				<button
					class="flex-1 px-2 py-2 text-[13px] font-medium cursor-pointer border-b-2 -mb-px transition-colors duration-150 focus:outline-none
					       {activeTab === 'turfs'
						? 'text-primary border-primary'
						: 'text-on-surface-subtle border-transparent hover:text-on-surface'}"
					onclick={() => (activeTab = 'turfs')}
				>
					Turfs <span class="font-normal text-on-surface-subtle">({turfFeatures.length})</span>
				</button>
			</div>

			{#if activeTab === 'locations'}
				<div class="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5" role="list">
					{#if locationsError}
						<p class="px-2.5 py-4 text-[13px] text-error leading-snug">{locationsError}</p>
					{/if}
					{#each pagedLocations as loc (loc.record_id)}
						<button
							class="flex flex-col items-start gap-0.5 px-2.5 py-2 rounded-lg cursor-pointer w-full text-left focus:outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2
							       {loc.record_id === selectedLocationId ? 'bg-primary-container' : 'hover:bg-surface-container'}"
							onclick={() => flyToLocation(loc)}
						>
							<span
								class="text-[13px] font-medium leading-snug
								       {loc.record_id === selectedLocationId ? 'text-on-primary-container' : 'text-on-surface'}"
								>{locationLabel(loc)}</span
							>
							{#if loc.address_line_1 && loc.name}
								<span
									class="text-xs leading-snug
									       {loc.record_id === selectedLocationId ? 'text-on-primary-container/75' : 'text-on-surface-subtle'}"
									>{loc.address_line_1}</span
								>
							{/if}
						</button>
					{/each}
				</div>

				{#if totalPages > 1}
					<div
						class="flex items-center justify-center gap-2 px-2.5 py-2.5 border-t border-outline-subtle shrink-0"
					>
						<button
							class="flex items-center justify-center w-7 h-7 rounded-md text-on-surface-subtle cursor-pointer enabled:hover:bg-surface-container enabled:hover:text-on-surface disabled:opacity-35 disabled:cursor-default focus:outline-none"
							onclick={() => currentPage--}
							disabled={currentPage === 0}
							aria-label="Previous page"
						>
							<CaretLeftIcon size={14} />
						</button>
						<span class="text-[13px] text-on-surface-subtle min-w-12 text-center"
							>{currentPage + 1} / {totalPages}</span
						>
						<button
							class="flex items-center justify-center w-7 h-7 rounded-md text-on-surface-subtle cursor-pointer enabled:hover:bg-surface-container enabled:hover:text-on-surface disabled:opacity-35 disabled:cursor-default focus:outline-none"
							onclick={() => currentPage++}
							disabled={currentPage >= totalPages - 1}
							aria-label="Next page"
						>
							<CaretRightIcon size={14} />
						</button>
					</div>
				{/if}
			{:else}
				<div class="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5" role="list">
					{#if turfItems.length === 0}
						<p class="text-[13px] text-on-surface-subtle text-center px-4 py-6 leading-relaxed">
							No turfs drawn yet. Use the polygon tool to define regions.
						</p>
					{:else}
						{#each turfItems as turf (turf.index)}
							<details
								class="flex flex-col gap-1 px-2.5 py-2 rounded-lg transition-colors
								       {hoveredTurfIndex === turf.index || activeSidebarTurfIndex === turf.index ? 'bg-primary/10' : 'hover:bg-surface-container'}"
								role="listitem"
								onmouseenter={() => (activeSidebarTurfIndex = turf.index)}
								onmouseleave={() => (activeSidebarTurfIndex = null)}
							>
								<summary
									class="flex items-baseline gap-1.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden focus:outline-none"
								>
									<span class="text-[13px] font-semibold text-on-surface leading-snug"
										>Turf {turf.index}</span
									>
									<span class="text-xs text-on-surface-subtle"
										>({turf.inside.length} location{turf.inside.length === 1 ? '' : 's'})</span
									>
								</summary>
								{#if turf.inside.length === 0}
									<span class="text-[11px] text-on-surface-subtle italic"
										>No locations in this region</span
									>
								{:else}
									<div
										class="flex flex-col gap-1.5 bg-surface-container rounded-md px-2.5 py-2 mt-0.5"
									>
										{#each turf.inside as loc (loc.record_id)}
											<div class="flex flex-col gap-px">
												<span class="text-xs font-medium text-on-surface leading-snug"
													>{locationLabel(loc)}</span
												>
												{#if loc.address_line_1 && loc.name}
													<span class="text-[11px] text-on-surface-subtle leading-snug"
														>{loc.address_line_1}</span
													>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</details>
						{/each}
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	:global(.maplibregl-ctrl-top-right) {
		right: var(--sidebar-w, 300px);
		transition: right 0.2s ease;
	}

	:global(.maplibregl-ctrl-top-right .maplibregl-ctrl-group) {
		background-color: var(--surface);
		border: 1px solid var(--outline-subtle);
		border-radius: 0.75rem;
		box-shadow:
			0 4px 6px -1px rgb(0 0 0 / 0.1),
			0 2px 4px -2px rgb(0 0 0 / 0.1);
		overflow: visible;
		padding: 0.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	:global(.maplibregl-ctrl-top-right .maplibregl-ctrl-group button + button) {
		border-top: none;
	}

	:global(.maplibregl-ctrl-top-right .maplibregl-ctrl-group button:first-child),
	:global(.maplibregl-ctrl-top-right .maplibregl-ctrl-group button:last-child),
	:global(.maplibregl-ctrl-top-right .maplibregl-ctrl-group button:only-child) {
		border-radius: 0.5rem;
	}

	:global(.maplibregl-ctrl-group button.gm-control-button) {
		color: var(--on-surface-subtle);
		background-color: transparent;
		border-radius: 0.5rem;
		width: 2rem;
		height: 2rem;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	:global(.maplibregl-ctrl-group button.gm-control-button svg) {
		width: 1rem;
		height: 1rem;
	}

	:global(.maplibregl-ctrl-group button.gm-control-button:hover) {
		color: var(--on-surface);
		background-color: var(--surface-container);
	}

	:global(.maplibregl-ctrl-group button.gm-control-button.active) {
		color: var(--on-primary);
		background-color: var(--primary);
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

	:global(.turf-name-tooltip .maplibregl-popup-content) {
		padding: 0.25rem 0.625rem;
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		font-weight: 600;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
		pointer-events: none;
	}

	:global(.turf-name-tooltip .maplibregl-popup-tip) { display: none; }

	:global(.maplibregl-popup-anchor-bottom .maplibregl-popup-tip) { border-top-color: var(--surface); }
	:global(.maplibregl-popup-anchor-top .maplibregl-popup-tip) { border-bottom-color: var(--surface); }
	:global(.maplibregl-popup-anchor-left .maplibregl-popup-tip) { border-right-color: var(--surface); }
	:global(.maplibregl-popup-anchor-right .maplibregl-popup-tip) { border-left-color: var(--surface); }
	:global(.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip),
	:global(.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip) { border-top-color: var(--surface); }
	:global(.maplibregl-popup-anchor-top-left .maplibregl-popup-tip),
	:global(.maplibregl-popup-anchor-top-right .maplibregl-popup-tip) { border-bottom-color: var(--surface); }

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

	progress::-webkit-progress-bar { background-color: rgb(0 0 0 / 0.15); border-radius: 3px; }
	progress::-webkit-progress-value { background-color: var(--primary); border-radius: 3px; }
	progress::-moz-progress-bar { background-color: var(--primary); border-radius: 3px; }
	progress.complete::-webkit-progress-value { background-color: rgb(0 0 0 / 0.25); }
	progress.complete::-moz-progress-bar { background-color: rgb(0 0 0 / 0.25); }

	:global([data-theme='dark']) progress { background-color: rgb(255 255 255 / 0.2); }
	:global([data-theme='dark']) progress::-webkit-progress-bar { background-color: rgb(255 255 255 / 0.2); }
	:global([data-theme='dark']) progress.complete::-webkit-progress-value { background-color: rgb(255 255 255 / 0.3); }
	:global([data-theme='dark']) progress.complete::-moz-progress-bar { background-color: rgb(255 255 255 / 0.3); }

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

	:global([data-theme='dark']) .indicator-content { color: rgb(255 255 255 / 0.55); }

	.loading-label {
		background: linear-gradient(
			90deg,
			rgb(0 0 0 / 0.25), rgb(0 0 0 / 0.55), rgb(0 0 0 / 0.35),
			rgb(0 0 0 / 0.6), rgb(0 0 0 / 0.2), rgb(0 0 0 / 0.55), rgb(0 0 0 / 0.25)
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
			rgb(255 255 255 / 0.25), rgb(255 255 255 / 0.65), rgb(255 255 255 / 0.35),
			rgb(255 255 255 / 0.7), rgb(255 255 255 / 0.2), rgb(255 255 255 / 0.65), rgb(255 255 255 / 0.25)
		);
		background-size: 300%;
		-webkit-background-clip: text;
		background-clip: text;
	}

	@keyframes shimmer-sweep {
		from { background-position: 0%; }
		to { background-position: 300%; }
	}
</style>
