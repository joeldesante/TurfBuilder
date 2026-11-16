<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import { page } from '$app/stores';
	import { themeStore } from '$lib/theme.svelte';
	import { getMapStyle } from '$lib/map-style';
	import Button from '$components/actions/button/Button.svelte';
	import LayerDialog, { type LayerGeoJSON } from '$components/feedback/layer-dialog/LayerDialog.svelte';
	import ConfirmDialog from '$components/feedback/confirm-dialog/ConfirmDialog.svelte';
	import { defaultLayerColor } from '$lib/shared/utils/layer-colors';
	import { geojsonBounds, type Bounds } from '$lib/shared/utils/geojson-bounds';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimple';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import EyeIcon from 'phosphor-svelte/lib/Eye';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlash';
	import ReorderList from '$components/layout/reorder-list/ReorderList.svelte';
	import SidebarIcon from 'phosphor-svelte/lib/SidebarSimple';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import DotsSixVerticalIcon from 'phosphor-svelte/lib/DotsSixVertical';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUp';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDown';

	import 'maplibre-gl/dist/maplibre-gl.css';

	/** The staff dashboard of the organization being viewed. */
	const dashboardHref = $derived(`/o/${$page.params.org_slug}/s/`);

	let mapContainer: HTMLDivElement;
	let map: maplibregl.Map | undefined;
	let sidebarOpen = $state(false);
	/** True once the current map style has loaded and can take sources and layers. */
	let styleReady = $state(false);

	type Layer = {
		id: number;
		name: string;
		color: string;
		/** The feature property drawn as each shape's label, or null for none. */
		labelField: string | null;
		visible: boolean;
		geojson: LayerGeoJSON;
	};

	/** Which layer dialog is open: adding a new layer, or editing the layer with this id. */
	let dialog = $state<'add' | number | null>(null);
	let deletingId = $state<number | null>(null);
	let layers = $state<Layer[]>([]);
	let nextLayerId = 1;

	const editingLayer = $derived(typeof dialog === 'number' ? layers.find((l) => l.id === dialog) : undefined);
	const deletingLayer = $derived(layers.find((l) => l.id === deletingId));

	function saveLayer(result: {
		name: string;
		color: string;
		labelField: string | null;
		geojson: LayerGeoJSON | null;
	}) {
		if (editingLayer) {
			editingLayer.name = result.name;
			editingLayer.color = result.color;
			editingLayer.labelField = result.labelField;
		} else if (result.geojson) {
			layers.push({
				id: nextLayerId,
				name: result.name,
				color: result.color,
				labelField: result.labelField,
				visible: true,
				geojson: result.geojson
			});
			nextLayerId++;
			zoomTo(result.geojson);
		}
	}

	/** The map's current view as west, south, east, north. */
	function viewBounds(): Bounds | null {
		if (!map) return null;
		const view = map.getBounds();
		return [view.getWest(), view.getSouth(), view.getEast(), view.getNorth()];
	}

	function zoomTo(geojson: LayerGeoJSON) {
		const bounds = geojsonBounds(geojson);
		if (!map || !bounds) return;
		map.fitBounds(
			[
				[bounds[0], bounds[1]],
				[bounds[2], bounds[3]]
			],
			{
				padding: { top: 60, bottom: 60, left: 60, right: sidebarOpen ? 340 : 60 },
				maxZoom: 16,
				duration: 600
			}
		);
	}

	const layerIdsFor = (id: number) => [
		`geo-${id}-fill`,
		`geo-${id}-line`,
		`geo-${id}-circle`,
		`geo-${id}-label`
	];

	/** Makes the map's sources and layers match the list: adds, recolors, removes and orders them. */
	function syncLayers() {
		if (!map || !styleReady) return;
		const current = map;

		// Drop the highlight and details of a shape whose layer was deleted or hidden.
		if (selected && !layerForSource(selected.source)?.visible) clearSelection();
		if (hovered && !layerForSource(hovered.source)?.visible) clearHover();

		const wanted = new Set(layers.map((l) => `geo-${l.id}`));
		for (const mapLayer of current.getStyle().layers ?? []) {
			const owner = /^(geo-\d+)-/.exec(mapLayer.id)?.[1];
			if (owner && !wanted.has(owner)) current.removeLayer(mapLayer.id);
		}
		for (const sourceId of Object.keys(current.getStyle().sources ?? {})) {
			if (sourceId.startsWith('geo-') && !wanted.has(sourceId)) current.removeSource(sourceId);
		}

		for (const layer of layers) {
			const sourceId = `geo-${layer.id}`;
			const [fillId, lineId, circleId, labelId] = layerIdsFor(layer.id);
			if (!current.getSource(sourceId)) {
				// Read without tracking: the file never changes, and a deep read of it would be slow.
				const data = untrack(() => $state.snapshot(layer.geojson));
				current.addSource(sourceId, { type: 'geojson', data: data as never, generateId: true });
				current.addLayer({
					id: fillId,
					type: 'fill',
					source: sourceId,
					filter: ['==', '$type', 'Polygon'],
					paint: {
						'fill-color': layer.color,
						'fill-opacity': [
							'case',
							['boolean', ['feature-state', 'selected'], false],
							0.55,
							['boolean', ['feature-state', 'hover'], false],
							0.45,
							0.3
						]
					}
				});
				current.addLayer({
					id: lineId,
					type: 'line',
					source: sourceId,
					filter: ['any', ['==', '$type', 'LineString'], ['==', '$type', 'Polygon']],
					paint: {
						'line-color': layer.color,
						'line-width': [
							'case',
							['boolean', ['feature-state', 'selected'], false],
							4,
							['boolean', ['feature-state', 'hover'], false],
							3,
							2
						]
					}
				});
				current.addLayer({
					id: circleId,
					type: 'circle',
					source: sourceId,
					filter: ['==', '$type', 'Point'],
					paint: {
						'circle-color': layer.color,
						'circle-radius': [
							'case',
							['boolean', ['feature-state', 'selected'], false],
							8,
							['boolean', ['feature-state', 'hover'], false],
							7,
							5
						],
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': 1.5
					}
				});
				current.addLayer({
					id: labelId,
					type: 'symbol',
					source: sourceId,
					layout: { 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-allow-overlap': false },
					paint: { 'text-color': '#18181b', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }
				});
			} else {
				current.setPaintProperty(fillId, 'fill-color', layer.color);
				current.setPaintProperty(lineId, 'line-color', layer.color);
				current.setPaintProperty(circleId, 'circle-color', layer.color);
			}
			for (const id of layerIdsFor(layer.id)) {
				current.setLayoutProperty(id, 'visibility', layer.visible ? 'visible' : 'none');
			}
			// Show the chosen property as text; with none chosen, an empty string draws nothing.
			current.setLayoutProperty(
				labelId,
				'text-field',
				layer.labelField ? ['to-string', ['get', layer.labelField]] : ''
			);
		}

		// The first layer in the list draws on top, so move each to the front from the bottom up.
		for (const layer of [...layers].reverse()) {
			for (const id of layerIdsFor(layer.id)) current.moveLayer(id);
		}
	}

	$effect(() => {
		// Read what the map shows so the effect reruns when it changes.
		void layers.map((l) => [l.id, l.color, l.visible, l.labelField]);
		void styleReady;
		syncLayers();
	});

	type FeatureRef = { source: string; id: string | number };

	let hovered: FeatureRef | null = null;
	let selected: FeatureRef | null = null;
	let hoverPopup: maplibregl.Popup | undefined;
	let detailPopup: maplibregl.Popup | undefined;

	const sameFeature = (a: FeatureRef | null, b: FeatureRef | null) =>
		a?.source === b?.source && a?.id === b?.id;

	function layerForSource(source: string) {
		return layers.find((l) => `geo-${l.id}` === source);
	}

	function setFeatureFlag(ref: FeatureRef | null, flag: 'hover' | 'selected', value: boolean) {
		if (map && ref) map.setFeatureState(ref, { [flag]: value });
	}

	/** The shapes that can be hovered or clicked: the drawn parts of every visible layer. */
	function interactiveLayerIds() {
		const current = map;
		if (!current) return [];
		return layers
			.filter((l) => l.visible)
			.flatMap((l) => layerIdsFor(l.id).slice(0, 3))
			.filter((id) => current.getLayer(id));
	}

	/** The top shape under the pointer, with a few pixels of slack so thin lines can be hit. */
	function featureAt(point: maplibregl.Point) {
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

	function clearHover() {
		setFeatureFlag(hovered, 'hover', false);
		hovered = null;
		hoverPopup?.remove();
		if (map) map.getCanvas().style.cursor = '';
	}

	function clearSelection() {
		const popup = detailPopup;
		detailPopup = undefined;
		popup?.remove();
		setFeatureFlag(selected, 'selected', false);
		selected = null;
	}

	function onMapMove(event: maplibregl.MapMouseEvent) {
		if (!map) return;
		const hit = featureAt(event.point);
		map.getCanvas().style.cursor = hit ? 'pointer' : '';
		const next: FeatureRef | null = hit ? { source: hit.source, id: hit.id! } : null;

		if (!sameFeature(next, hovered)) {
			setFeatureFlag(hovered, 'hover', false);
			hovered = next;
			setFeatureFlag(hovered, 'hover', true);
		}

		if (!hit || !next) {
			hoverPopup?.remove();
			return;
		}
		const layer = layerForSource(next.source);
		const labelValue = layer?.labelField ? hit.properties?.[layer.labelField] : null;
		const text = labelValue !== null && labelValue !== undefined ? String(labelValue) : (layer?.name ?? '');
		hoverPopup?.setLngLat(event.lngLat).setText(text).addTo(map);
	}

	/** One property value as text, cut short so a huge value cannot flood the popup. */
	function valueText(value: unknown) {
		const text = typeof value === 'string' ? value : JSON.stringify(value);
		return text.length > 200 ? `${text.slice(0, 200)}...` : text;
	}

	function detailsFor(layerName: string, properties: Record<string, unknown>) {
		// Built from text nodes, never HTML: the values come from the uploaded file.
		const root = document.createElement('div');
		root.className = 'text-sm';
		const title = document.createElement('p');
		title.className = 'font-semibold mb-1';
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

	function onMapClick(event: maplibregl.MapMouseEvent) {
		if (!map) return;
		clearSelection();
		const hit = featureAt(event.point);
		if (!hit) return;

		selected = { source: hit.source, id: hit.id! };
		setFeatureFlag(selected, 'selected', true);
		const layer = layerForSource(hit.source);
		const popup = new maplibregl.Popup({ closeOnClick: false, maxWidth: '300px', offset: 8 })
			.setLngLat(event.lngLat)
			.setDOMContent(detailsFor(layer?.name ?? 'Layer', hit.properties ?? {}))
			.addTo(map);
		popup.on('close', () => {
			if (detailPopup === popup) clearSelection();
		});
		detailPopup = popup;
	}

	function deleteLayer() {
		layers = layers.filter((l) => l.id !== deletingId);
		deletingId = null;
	}

	function moveLayer(from: number, to: number) {
		if (to < 0 || to >= layers.length || from === to) return;
		const [moved] = layers.splice(from, 1);
		layers.splice(to, 0, moved);
	}

	function layerById(id: string) {
		return layers.find((l) => String(l.id) === id)!;
	}

	function reorderLayers(ids: string[]) {
		layers = ids.map((id) => layerById(id));
	}

	function isDarkTheme() {
		return document.documentElement.getAttribute('data-theme') === 'dark';
	}

	$effect(() => {
		void themeStore.theme;
		if (map) {
			styleReady = false;
			// A new style drops every source, and the highlights with them.
			hovered = null;
			selected = null;
			hoverPopup?.remove();
			clearSelection();
			getMapStyle(isDarkTheme()).then((style) => map?.setStyle(style as never));
		}
	});

	onMount(() => {
		getMapStyle(isDarkTheme()).then((style) => {
			map = new maplibregl.Map({
				container: mapContainer,
				style: style as never,
				center: [-75.2238, 40.0259],
				zoom: 11,
				attributionControl: { compact: true }
			});
			map.on('style.load', () => (styleReady = true));
			hoverPopup = new maplibregl.Popup({
				closeButton: false,
				closeOnClick: false,
				className: 'map-editor-tooltip',
				offset: 14
			});
			map.on('mousemove', onMapMove);
			map.on('mouseout', clearHover);
			map.on('click', onMapClick);
		});

		return () => map?.remove();
	});
</script>

<svelte:head>
	<title>Map Editor</title>
</svelte:head>

<style>
	:global(.maplibregl-popup-content) {
		background: var(--surface);
		color: var(--on-surface);
		border: 1px solid var(--outline-subtle);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
	}
	:global(.maplibregl-popup-close-button) {
		color: var(--on-surface-subtle);
	}
	:global(.maplibregl-popup-anchor-bottom .maplibregl-popup-tip) {
		border-top-color: var(--surface);
	}
	:global(.maplibregl-popup-anchor-top .maplibregl-popup-tip) {
		border-bottom-color: var(--surface);
	}
	:global(.map-editor-tooltip) {
		pointer-events: none;
	}
	:global(.map-editor-tooltip .maplibregl-popup-tip) {
		display: none;
	}
</style>

<LayerDialog
	open={dialog !== null}
	layer={editingLayer}
	defaultColor={defaultLayerColor(layers.length)}
	getViewBounds={viewBounds}
	onSave={saveLayer}
	onClose={() => (dialog = null)}
/>

<ConfirmDialog
	open={deletingId !== null}
	title="Delete layer"
	description={`Delete "${deletingLayer?.name ?? ''}" from the map? This cannot be undone.`}
	confirmLabel="Delete"
	destructive
	onConfirm={deleteLayer}
	onCancel={() => (deletingId = null)}
/>

<div class="relative w-screen h-screen overflow-hidden">
	<div bind:this={mapContainer} class="w-full h-full"></div>

	<div class="absolute top-2.5 left-2.5 z-20">
		<Button variant="outline" href={dashboardHref} class="!bg-surface">← Back to Dashboard</Button>
	</div>

	<aside
		id="map-editor-sidebar"
		aria-label="Map editor sidebar"
		inert={!sidebarOpen}
		class="absolute top-0 right-0 z-10 h-full w-80 max-w-full bg-surface border-l border-outline-subtle shadow-lg transition-transform duration-200 {sidebarOpen
			? 'translate-x-0'
			: 'translate-x-full'}"
	>
		<div class="flex flex-col h-full">
			<div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-outline-subtle shrink-0">
				<h2 class="text-sm font-semibold text-on-surface">Layers</h2>
				<Button variant="outline" size="sm" onclick={() => (dialog = 'add')}>
					<PlusIcon class="size-4" />
					Add Layer
				</Button>
			</div>

			<ReorderList
				ids={layers.map((l) => String(l.id))}
				onReorder={reorderLayers}
				axis="y"
				aria-label="Layers"
				class="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5"
				itemClass={() => 'list-none'}
			>
				{#snippet item(id, dragging)}
					{@const layer = layerById(id)}
					{@const i = layers.indexOf(layer)}
					<div
						class="flex items-center gap-1 h-9 pl-1 pr-1 rounded-md border border-transparent bg-surface text-sm text-on-surface {dragging
							? 'shadow-md border-outline-subtle'
							: 'hover:bg-surface-container-high'}"
					>
						<span class="cursor-grab text-on-surface-subtle" aria-hidden="true">
							<DotsSixVerticalIcon class="size-4" />
						</span>
						<span
							class="size-4 shrink-0 rounded-full border border-black/10 {layer.visible ? '' : 'opacity-40'}"
							style="background-color: {layer.color};"
							role="img"
							aria-label="{layer.name} color"
						></span>
						<span class="flex-1 truncate">{layer.name}</span>
						<button
							type="button"
							class="flex size-6 items-center justify-center rounded hover:bg-surface-container-highest disabled:opacity-30"
							aria-label="Move {layer.name} up"
							disabled={i === 0}
							onclick={() => moveLayer(i, i - 1)}
						>
							<CaretUpIcon class="size-3.5" />
						</button>
						<button
							type="button"
							class="flex size-6 items-center justify-center rounded hover:bg-surface-container-highest disabled:opacity-30"
							aria-label="Move {layer.name} down"
							disabled={i === layers.length - 1}
							onclick={() => moveLayer(i, i + 1)}
						>
							<CaretDownIcon class="size-3.5" />
						</button>
						<button
							type="button"
							class="flex size-6 items-center justify-center rounded hover:bg-surface-container-highest {layer.visible
								? ''
								: 'text-on-surface-subtle'}"
							aria-label="{layer.visible ? 'Hide' : 'Show'} {layer.name}"
							aria-pressed={layer.visible}
							onclick={() => (layer.visible = !layer.visible)}
						>
							{#if layer.visible}
								<EyeIcon class="size-3.5" />
							{:else}
								<EyeSlashIcon class="size-3.5" />
							{/if}
						</button>
						<button
							type="button"
							class="flex size-6 items-center justify-center rounded hover:bg-surface-container-highest"
							aria-label="Edit {layer.name}"
							onclick={() => (dialog = layer.id)}
						>
							<PencilSimpleIcon class="size-3.5" />
						</button>
						<button
							type="button"
							class="flex size-6 items-center justify-center rounded text-error hover:bg-surface-container-highest"
							aria-label="Delete {layer.name}"
							onclick={() => (deletingId = layer.id)}
						>
							<TrashIcon class="size-3.5" />
						</button>
					</div>
				{/snippet}
			</ReorderList>
		</div>
	</aside>

	<div
		class="absolute top-2.5 z-20 transition-[right] duration-200"
		style="right: {sidebarOpen ? 'calc(20rem + 0.625rem)' : '0.625rem'};"
	>
		<Button
			variant="outline"
			iconOnly
			class="!bg-surface"
			aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
			aria-expanded={sidebarOpen}
			aria-controls="map-editor-sidebar"
			onclick={() => (sidebarOpen = !sidebarOpen)}
		>
			<SidebarIcon class="size-5" />
		</Button>
	</div>
</div>
