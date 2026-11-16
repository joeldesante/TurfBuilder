<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { errorMessage } from '$lib/client/api';
	import Button from '$components/actions/button/Button.svelte';
	import LayerDialog from '$components/feedback/layer-dialog/LayerDialog.svelte';
	import ConfirmDialog from '$components/feedback/confirm-dialog/ConfirmDialog.svelte';
	import MapView, { type MapLayerData } from '$components/data-display/map-view/MapView.svelte';
	import ReorderList from '$components/layout/reorder-list/ReorderList.svelte';
	import { defaultLayerColor } from '$lib/shared/utils/layer-colors';
	import type { Bounds } from '$lib/shared/utils/geojson-bounds';
	import type { LayerGeoJSON, MapLayer, MapLayerSummary } from '$lib/shared/types/map-layers';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimple';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import EyeIcon from 'phosphor-svelte/lib/Eye';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlash';
	import SidebarIcon from 'phosphor-svelte/lib/SidebarSimple';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import DotsSixVerticalIcon from 'phosphor-svelte/lib/DotsSixVertical';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUp';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDown';

	/**
	 * The full-screen map editor. Staff add GeoJSON layers (from a file or the
	 * catalogue), recolor, rename, reorder, hide and delete them. Every change but
	 * hiding is saved through the callbacks; hiding only affects this view.
	 */
	interface Props {
		/** The saved layers, top first. */
		layers: MapLayer[];
		/** Where the back button goes. */
		dashboardHref: string;
		onCreate: (input: {
			name: string;
			color: string;
			label_field: string | null;
			geojson: LayerGeoJSON;
		}) => Promise<MapLayerSummary>;
		onUpdate: (
			id: string,
			changes: { name: string; color: string; label_field: string | null }
		) => Promise<MapLayerSummary>;
		onDelete: (id: string) => Promise<void>;
		/** Saves the order, top first. */
		onReorder: (ids: string[]) => Promise<void>;
	}

	let { layers: savedLayers, dashboardHref, onCreate, onUpdate, onDelete, onReorder }: Props = $props();

	/** The editor always has every layer's shapes: it loads them all up front, and new ones come from the upload. */
	type EditorLayer = MapLayerData & { geojson: LayerGeoJSON };

	const toView = (layer: MapLayerSummary, geojson: LayerGeoJSON): EditorLayer => ({
		id: layer.id,
		name: layer.name,
		color: layer.color,
		labelField: layer.label_field,
		visible: true,
		geojson
	});

	// Edited here and saved through the callbacks, rather than reloaded after
	// each change: a reload would send every layer's GeoJSON again.
	// Raw, not deep state: a layer's GeoJSON can be hundreds of thousands of
	// nested arrays, and watching them all stalls the page. So every change
	// replaces the list (and the changed layer) instead of editing in place.
	// svelte-ignore state_referenced_locally
	let layers = $state.raw<EditorLayer[]>(savedLayers.map((l: MapLayer) => toView(l, l.geojson)));

	/** Replaces one layer with a changed copy. */
	function patchLayer(id: string, changes: Partial<EditorLayer>) {
		layers = layers.map((l) => (l.id === id ? { ...l, ...changes } : l));
	}

	let mapView = $state<ReturnType<typeof MapView>>();
	let sidebarOpen = $state(false);
	/** Which layer dialog is open: adding a new layer, or editing the layer with this id. */
	let dialog = $state<'add' | string | null>(null);
	let deletingId = $state<string | null>(null);

	const editingLayer = $derived(
		dialog !== null && dialog !== 'add' ? layers.find((l) => l.id === dialog) : undefined
	);
	const deletingLayer = $derived(layers.find((l) => l.id === deletingId));

	function viewBounds(): Bounds | null {
		const b = mapView?.getViewBounds();
		return b ? [b.west, b.south, b.east, b.north] : null;
	}

	function zoomTo(geojson: LayerGeoJSON) {
		mapView?.fitGeoJSON(geojson, { top: 60, bottom: 60, left: 60, right: sidebarOpen ? 340 : 60 });
	}

	function failed(e: unknown, what: string) {
		toast.error(errorMessage(e, `The layer could not be ${what}.`));
	}

	async function saveLayer(result: {
		name: string;
		color: string;
		labelField: string | null;
		geojson: LayerGeoJSON | null;
	}) {
		const changes = { name: result.name, color: result.color, label_field: result.labelField };

		if (editingLayer) {
			const { id } = editingLayer;
			const before = { name: editingLayer.name, color: editingLayer.color, labelField: editingLayer.labelField };
			patchLayer(id, { name: result.name, color: result.color, labelField: result.labelField });
			try {
				await onUpdate(id, changes);
			} catch (e) {
				patchLayer(id, before);
				failed(e, 'saved');
			}
			return;
		}

		if (!result.geojson) return;
		const geojson = result.geojson;
		try {
			const saved = await onCreate({ ...changes, geojson });
			// New layers are saved on top, so they go first here too.
			layers = [toView(saved, geojson), ...layers];
			zoomTo(geojson);
		} catch (e) {
			failed(e, 'saved');
		}
	}

	async function deleteLayer() {
		const id = deletingId;
		deletingId = null;
		if (!id) return;
		const before = layers;
		layers = layers.filter((l) => l.id !== id);
		try {
			await onDelete(id);
		} catch (e) {
			layers = before;
			failed(e, 'deleted');
		}
	}

	async function setOrder(next: EditorLayer[]) {
		const before = layers;
		layers = next;
		try {
			await onReorder(next.map((l) => l.id));
		} catch (e) {
			layers = before;
			failed(e, 'moved');
		}
	}

	function moveLayer(from: number, to: number) {
		if (to < 0 || to >= layers.length || from === to) return;
		const next = [...layers];
		const [moved] = next.splice(from, 1);
		next.splice(to, 0, moved);
		setOrder(next);
	}

	function layerById(id: string) {
		return layers.find((l) => l.id === id)!;
	}

	function reorderLayers(ids: string[]) {
		setOrder(ids.map((id) => layerById(id)));
	}
</script>

<svelte:head>
	<title>Map Editor</title>
</svelte:head>

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
	<MapView bind:this={mapView} {layers} class="w-full h-full" />

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
				ids={layers.map((l) => l.id)}
				onReorder={reorderLayers}
				axis="y"
				aria-label="Layers"
				class="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5"
				itemClass={() => 'list-none'}
			>
				{#snippet item(id, dragging)}
					{@const layer = layerById(id)}
					{@const i = layers.indexOf(layer)}
					{@const visible = layer.visible !== false}
					<div
						class="flex items-center gap-1 h-9 pl-1 pr-1 rounded-md border border-transparent bg-surface text-sm text-on-surface {dragging
							? 'shadow-md border-outline-subtle'
							: 'hover:bg-surface-container-high'}"
					>
						<span class="cursor-grab text-on-surface-subtle" aria-hidden="true">
							<DotsSixVerticalIcon class="size-4" />
						</span>
						<span
							class="size-4 shrink-0 rounded-full border border-black/10 {visible ? '' : 'opacity-40'}"
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
							class="flex size-6 items-center justify-center rounded hover:bg-surface-container-highest {visible
								? ''
								: 'text-on-surface-subtle'}"
							aria-label="{visible ? 'Hide' : 'Show'} {layer.name}"
							aria-pressed={visible}
							onclick={() => patchLayer(layer.id, { visible: !visible })}
						>
							{#if visible}
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
