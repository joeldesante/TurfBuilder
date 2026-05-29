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
		contact_made: boolean | null;
	};

	type TurfEntry = {
		id: string;
		code: string;
		created_at: string;
		expires_at: string;
		author: string;
		survey_name: string | null;
		bounds: string | null;
	};

	import { mount, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';
	import maplibregl from 'maplibre-gl';
	import Button from '$components/actions/button/Button.svelte';
	import { themeStore } from '$lib/theme.svelte';
	import { getMapStyle } from '$lib/map-style';
	import MapMarker, { type Variant } from '$components/data-display/map-marker/MapMarker.svelte';
	import MapPopup from '$components/data-display/map-popup/MapPopup.svelte';
	import SidebarIcon from 'phosphor-svelte/lib/Sidebar';
	import Spinner from '$components/feedback/spinner/Spinner.svelte';
	import SmileyIcon from 'phosphor-svelte/lib/Smiley';
	import CopyButton from '$components/actions/copy-button/CopyButton.svelte';

	import 'maplibre-gl/dist/maplibre-gl.css';

	let { data } = $props();

	const { org_slug } = $page.params;
	const listHref = $derived(
		`/o/${org_slug}/s/universe/buckets/${data.bucketSlug}/lists/${data.listId}`
	);

	let mapContainer: HTMLDivElement;
	const DEFAULT_ZOOM = 12;

	let map: maplibregl.Map;
	let locations: ListLocation[] = $state([]);
	let turfs: TurfEntry[] = $state([]);
	let markers: { id: string; marker: maplibregl.Marker }[] = [];

	let sidebarOpen = $state(true);
	let showExpired = $state(false);

	let mapLoading = $state(false);
	let mapLoadingComplete = $state(false);
	let locationsLoading = $state(true);
	let turfsLoading = $state(true);
	let locationsError = $state<string | null>(null);
	let tilesTotal = $state(0);
	let tilesLoaded = $state(0);

	let hoveredTurfId = $state<string | null>(null);
	let selectedTurfId = $state<string | null>(null);
	let selectedTurf = $derived(turfs.find((t) => t.id === selectedTurfId) ?? null);
	let hoverPopup: maplibregl.Popup;

	function setSelectedTurfId(id: string | null) {
		if (selectedTurfId) {
			map.setFeatureState({ source: 'turfs', id: selectedTurfId }, { selected: false });
		}
		selectedTurfId = id;
		if (id) {
			map.setFeatureState({ source: 'turfs', id }, { selected: true });
			if (!sidebarOpen) sidebarOpen = true;
		}
	}

	function isTurfExpired(turf: TurfEntry): boolean {
		return new Date(turf.expires_at) < new Date();
	}

	const visibleTurfs = $derived(
		showExpired ? turfs : turfs.filter((t) => !isTurfExpired(t))
	);

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function locationLabel(loc: ListLocation): string {
		return loc.name ?? loc.address_line_1 ?? 'Unknown';
	}

	function locationVariant(contactMade: boolean | null): Variant {
		if (contactMade === true) return 'contacted';
		if (contactMade === false) return 'no-contact';
		return 'unvisited';
	}

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

	function buildTurfGeoJSON(turfList: TurfEntry[]) {
		return {
			type: 'FeatureCollection' as const,
			features: turfList
				.filter((t) => t.bounds)
				.map((t) => ({
					type: 'Feature' as const,
					id: t.id,
					geometry: JSON.parse(t.bounds!),
					properties: {
						id: t.id,
						code: t.code,
						expired: isTurfExpired(t)
					}
				}))
		};
	}

	function syncTurfLayers() {
		if (!map) return;
		const source = map.getSource('turfs') as maplibregl.GeoJSONSource | undefined;
		if (!source) return;
		source.setData(buildTurfGeoJSON(visibleTurfs));
	}

	$effect(() => {
		const _ = visibleTurfs;
		syncTurfLayers();
	});

	function addTurfLayers() {
		if (!map.getSource('turfs')) {
			map.addSource('turfs', {
				type: 'geojson',
				data: buildTurfGeoJSON(visibleTurfs),
				promoteId: 'id'
			});
		}

		if (!map.getLayer('turfs-fill')) {
			map.addLayer({
				id: 'turfs-fill',
				type: 'fill',
				source: 'turfs',
				paint: {
					'fill-color': [
						'case',
						['get', 'expired'], '#ef4444',
						'#10b981'
					],
					'fill-opacity': [
						'case',
						['boolean', ['feature-state', 'selected'], false], 0.35,
						['boolean', ['feature-state', 'hovered'], false], 0.25,
						0.15
					]
				}
			});
		}

		if (!map.getLayer('turfs-outline')) {
			map.addLayer({
				id: 'turfs-outline',
				type: 'line',
				source: 'turfs',
				paint: {
					'line-color': [
						'case',
						['get', 'expired'], '#ef4444',
						'#10b981'
					],
					'line-width': [
						'case',
						['boolean', ['feature-state', 'selected'], false], 3,
						['boolean', ['feature-state', 'hovered'], false], 2.5,
						2
					],
					'line-opacity': 0.85
				}
			});
		}

		if (!map.getLayer('turfs-labels')) {
			map.addLayer({
				id: 'turfs-labels',
				type: 'symbol',
				source: 'turfs',
				layout: {
					'text-field': ['get', 'code'],
					'text-font': ['Noto Sans Bold'],
					'text-size': 12,
					'text-anchor': 'center',
					'text-allow-overlap': false
				},
				paint: {
					'text-color': '#111827',
					'text-halo-color': '#ffffff',
					'text-halo-width': 3
				}
			});
		}

	}

	function setupMapEvents() {
		map.on('mousemove', 'turfs-fill', (e) => {
			if (!e.features || e.features.length === 0) return;
			const id = e.features[0].properties?.id as string;
			if (hoveredTurfId && hoveredTurfId !== id) {
				map.setFeatureState({ source: 'turfs', id: hoveredTurfId }, { hovered: false });
			}
			hoveredTurfId = id;
			map.setFeatureState({ source: 'turfs', id }, { hovered: true });
			map.getCanvas().style.cursor = 'pointer';

			const turf = turfs.find((t) => t.id === id);
			if (turf) {
				hoverPopup
					.setLngLat(e.lngLat)
					.setHTML(`<strong>${turf.code}</strong>`)
					.addTo(map);
			}
		});

		map.on('mouseleave', 'turfs-fill', () => {
			if (hoveredTurfId) {
				map.setFeatureState({ source: 'turfs', id: hoveredTurfId }, { hovered: false });
			}
			hoveredTurfId = null;
			map.getCanvas().style.cursor = '';
			hoverPopup.remove();
		});

		let clickedTurf = false;

		map.on('click', 'turfs-fill', (e) => {
			if (!e.features || e.features.length === 0) return;
			clickedTurf = true;
			const id = e.features[0].properties?.id as string;
			setSelectedTurfId(selectedTurfId === id ? null : id);
		});

		map.on('click', () => {
			if (clickedTurf) { clickedTurf = false; return; }
			setSelectedTurfId(null);
		});
	}

	function createMarker(loc: ListLocation) {
		const element = document.createElement('div');

		mount(MapMarker, {
			target: element,
			props: { variant: locationVariant(loc.contact_made), get isSelected() { return false; } }
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

	async function loadLocations() {
		locationsLoading = true;
		locationsError = null;
		try {
			const res = await fetch(`/o/${org_slug}/s/api/universe/lists/${data.listId}/locations`);
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				locationsError = body.error ?? `Failed to load locations (${res.status})`;
				return;
			}
			const locs: ListLocation[] = await res.json();
			if (locs.length === 0) {
				locationsError = 'No locations with coordinates found in this list.';
				return;
			}
			locations = locs;
			for (const loc of locations) createMarker(loc);
		} finally {
			locationsLoading = false;
		}
	}

	async function loadTurfs() {
		turfsLoading = true;
		try {
			const res = await fetch(`/o/${org_slug}/s/api/universe/lists/${data.listId}/turfs`);
			if (!res.ok) return;
			const data_: TurfEntry[] = await res.json();
			turfs = data_;
			syncTurfLayers();
		} finally {
			turfsLoading = false;
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
				new maplibregl.LngLatBounds(
					[locs[0].longitude, locs[0].latitude],
					[locs[0].longitude, locs[0].latitude]
				)
			);
		} catch {
			return null;
		}
	}

	onMount(() => {
		(async () => {
			const [style, initialBounds] = await Promise.all([
				getMapStyle(isDarkTheme()),
				fetchInitialBounds()
			]);

			map = new maplibregl.Map({
				container: mapContainer,
				//@ts-ignore
				style,
				...(initialBounds
					? { bounds: initialBounds, fitBoundsOptions: { padding: 60, maxZoom: 16 } }
					: { center: [-75.2238, 40.0259], zoom: DEFAULT_ZOOM }),
				attributionControl: { compact: true }
			});

			hoverPopup = new maplibregl.Popup({
				closeButton: false,
				closeOnClick: false,
				className: 'turf-name-tooltip',
				offset: [0, -6]
			});

			map.on('style.load', addTurfLayers);

			map.on('load', () => {
				addTurfLayers();
				setupMapEvents();
				loadLocations();
				loadTurfs();
			});

			map.on('dataloading', () => {
				mapLoading = true;
				mapLoadingComplete = false;
				tilesTotal = 0;
				tilesLoaded = 0;
			});
			map.on('sourcedataloading', (e) => { if (e.tile) tilesTotal++; });
			map.on('sourcedata', (e) => { if (e.tile) tilesLoaded++; });
			map.on('idle', () => {
				mapLoading = false;
				mapLoadingComplete = true;
			});
		})();

		return () => { if (map) map.remove(); };
	});
</script>

<div class="relative">
	<div bind:this={mapContainer} class="w-screen h-screen"></div>

	<div class="absolute top-2.5 left-2.5 flex gap-2 items-center">
		<Button variant="outline" href={listHref} class="!bg-surface">← Back to List</Button>
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
		       {sidebarOpen ? 'bottom-2.5 w-[300px]' : 'w-auto'}"
	>
		<div
			class="flex items-center justify-between p-2 gap-2 shrink-0
			       {sidebarOpen ? 'border-b border-outline-subtle' : ''}"
		>
			{#if sidebarOpen}
				<span class="text-sm font-semibold text-on-surface">Turfs</span>
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
			<div class="flex items-center gap-2 px-3 py-2 border-b border-outline-subtle shrink-0">
				<label class="flex items-center gap-2 text-[13px] text-on-surface-subtle cursor-pointer select-none">
					<input
						type="checkbox"
						bind:checked={showExpired}
						class="rounded accent-primary cursor-pointer"
					/>
					Show expired turfs
				</label>
			</div>

			{#if selectedTurf}
				<div class="p-3 border-b border-outline-subtle bg-surface-container/50 shrink-0">
					<div class="flex items-center justify-between gap-2">
						<div class="flex items-center gap-1">
							<span class="font-mono text-sm font-semibold text-on-surface">{selectedTurf.code}</span>
							<CopyButton value={selectedTurf.code} aria-label="Copy turf code" />
						</div>
						<button
							class="text-on-surface-subtle hover:text-on-surface text-xs shrink-0"
							onclick={() => setSelectedTurfId(null)}
						>
							Clear
						</button>
					</div>
					{#if selectedTurf.survey_name}
						<p class="text-xs text-on-surface-subtle mt-0.5">{selectedTurf.survey_name}</p>
					{/if}
					<div class="mt-2 flex flex-col gap-1">
						<div class="flex gap-2 text-xs">
							<span class="text-on-surface-subtle w-16 shrink-0">Cut by</span>
							<span class="text-on-surface">{selectedTurf.author}</span>
						</div>
						<div class="flex gap-2 text-xs">
							<span class="text-on-surface-subtle w-16 shrink-0">Cut on</span>
							<span class="text-on-surface">{formatDate(selectedTurf.created_at)}</span>
						</div>
						<div class="flex gap-2 text-xs">
							<span class="text-on-surface-subtle w-16 shrink-0">Expires</span>
							<span class={isTurfExpired(selectedTurf) ? 'text-error' : 'text-on-surface'}>
								{isTurfExpired(selectedTurf) ? 'Expired' : ''} {formatDate(selectedTurf.expires_at)}
							</span>
						</div>
					</div>
				</div>
			{/if}

			<div class="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5" role="list">
				{#if turfsLoading}
					<p class="text-[13px] text-on-surface-subtle text-center px-4 py-6">Loading turfs...</p>
				{:else if visibleTurfs.length === 0}
					<p class="text-[13px] text-on-surface-subtle text-center px-4 py-6 leading-relaxed">
						{turfs.length === 0 ? 'No turfs have been cut for this list.' : 'No active turfs. Enable "Show expired turfs" to see all.'}
					</p>
				{:else}
					{#each visibleTurfs as turf (turf.id)}
						<button
							class="flex flex-col items-start gap-0.5 px-2.5 py-2 rounded-lg cursor-pointer w-full text-left focus:outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2
							       {selectedTurfId === turf.id ? 'bg-primary-container' : hoveredTurfId === turf.id ? 'bg-surface-container' : 'hover:bg-surface-container'}"
							onclick={() => setSelectedTurfId(selectedTurfId === turf.id ? null : turf.id)}
							onmouseenter={() => {
								if (!map) return;
								hoveredTurfId = turf.id;
								map.setFeatureState({ source: 'turfs', id: turf.id }, { hovered: true });
							}}
							onmouseleave={() => {
								if (!map) return;
								map.setFeatureState({ source: 'turfs', id: turf.id }, { hovered: false });
								hoveredTurfId = null;
							}}
						>
							<div class="flex items-center gap-1 w-full">
								<span
									class="font-mono text-[13px] font-semibold leading-snug
									       {selectedTurfId === turf.id ? 'text-on-primary-container' : 'text-on-surface'}"
								>{turf.code}</span>
								<span onclick={(e) => e.stopPropagation()}>
									<CopyButton value={turf.code} aria-label="Copy turf code" />
								</span>
								{#if isTurfExpired(turf)}
									<span class="text-[10px] font-medium text-error bg-error/10 rounded px-1 py-px">Expired</span>
								{/if}
							</div>
							<span class="text-xs text-on-surface-subtle">
								Cut {formatDate(turf.created_at)}
							</span>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
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
