<script lang="ts" module>
	import type { LayerGeoJSON } from '$lib/shared/types/map-layers';
	export type { LayerGeoJSON };

	const GEOJSON_TYPES = [
		'FeatureCollection',
		'Feature',
		'Point',
		'MultiPoint',
		'LineString',
		'MultiLineString',
		'Polygon',
		'MultiPolygon',
		'GeometryCollection'
	];

	/** Reads a file as GeoJSON. Throws an Error whose message is safe to show a user. */
	export async function readGeoJSON(file: File): Promise<LayerGeoJSON> {
		let parsed: unknown;
		try {
			parsed = JSON.parse(await file.text());
		} catch {
			throw new Error('The file is not valid JSON, so it cannot be read as GeoJSON.');
		}
		const type = (parsed as { type?: unknown } | null)?.type;
		if (typeof type !== 'string' || !GEOJSON_TYPES.includes(type)) {
			throw new Error('The file is JSON, but it is not GeoJSON.');
		}
		return parsed as LayerGeoJSON;
	}
</script>

<script lang="ts">
	import { Dialog } from 'bits-ui';
	import Dropdown from '$components/data-inputs/dropdown/Dropdown.svelte';
	import { geojsonPropertyKeys } from '$lib/shared/utils/geojson-properties';
	import { LAYER_COLORS } from '$lib/shared/utils/layer-colors';
	import Button from '$components/actions/button/Button.svelte';
	import ColorSwatchPicker from '$components/data-inputs/color-swatch-picker/ColorSwatchPicker.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import OfficialBadge from '$components/data-display/official-badge/OfficialBadge.svelte';
	import SourceBadge from '$components/data-display/source-badge/SourceBadge.svelte';
	import GeometryBadge from '$components/data-display/geometry-badge/GeometryBadge.svelte';
	import { geojsonGeometryCounts, type GeometryKind } from '$lib/shared/utils/geojson-geometry';
	import ToggleGroup from '$components/data-inputs/toggle-group/ToggleGroup.svelte';
	import LayerCatalogue from '$components/data-inputs/layer-catalogue/LayerCatalogue.svelte';
	import { CatalogueError, loadCatalogueLayer } from '$lib/client/layer-catalogue';
	import type { CatalogueEntry } from '$lib/shared/registries/layer-catalogue';
	import type { Bounds } from '$lib/shared/utils/geojson-bounds';
	import FileDropzone from '$components/data-inputs/file-dropzone/FileDropzone.svelte';

	/**
	 * A modal for a map layer. Without `layer` it adds one, from a GeoJSON file dropped
	 * on a drop zone or from the catalogue of city and federal layers; the layer name
	 * starts as the file's or catalogue entry's name. With `layer` it edits that
	 * layer's name and color, with no file needed. The color is picked from a fixed list.
	 */
	interface Props {
		open: boolean;
		/** The layer being edited. Leave out to add a new one. */
		layer?: { name: string; color: string; labelField: string | null; geojson: LayerGeoJSON };
		/** The color a new layer starts with. @default the first color in the list */
		defaultColor?: string;
		/** The map's current view (west, south, east, north), for catalogue layers that load only what is in view. */
		getViewBounds?: () => Bounds | null;
		/**
		 * Called with the chosen name, color and label field (null for no label), and the
		 * parsed GeoJSON when adding.
		 */
		onSave: (result: {
			name: string;
			color: string;
			labelField: string | null;
			geojson: LayerGeoJSON | null;
		}) => void;
		onClose: () => void;
	}

	const {
		open,
		layer,
		defaultColor = LAYER_COLORS[0].value,
		getViewBounds,
		onSave,
		onClose
	}: Props = $props();

	const editing = $derived(!!layer);

	/** Where a new layer comes from. */
	let from = $state('catalogue');
	let loadingId = $state<string | null>(null);
	let catalogueError = $state('');
	let catalogueNotice = $state('');

	let geojson = $state<LayerGeoJSON | null>(null);

	/** Adding takes two steps: pick the source, then set the details. Editing has only the details. */
	const step = $derived(editing || geojson ? 'details' : 'source');
	/** Where the loaded layer came from, shown on the details step. */
	let sourceLabel = $state('');
	/** The catalogue layer the loaded layer came from, to show where it is from and link to it. */
	let pickedEntry = $state<CatalogueEntry | null>(null);
	let name = $state('');
	let color = $state<string>(LAYER_COLORS[0].value);
	/** The property shown as each shape's label; empty for no label. */
	let labelField = $state('');

	/** The properties the label can come from: the new file's, or the edited layer's. */
	const fields = $derived(geojsonPropertyKeys(geojson ?? layer?.geojson));
	/** What the loaded layer is made of, for the badges on the details step. */
	const kinds = $derived.by(() => {
		const counts = geojsonGeometryCounts(geojson ?? layer?.geojson);
		return (['polygon', 'line', 'point'] as GeometryKind[])
			.filter((kind) => counts[kind] > 0)
			.map((kind) => ({ kind, count: counts[kind] }));
	});
	const labelItems = $derived([
		{ value: '', label: 'No label' },
		...fields.map((field) => ({ value: field, label: field }))
	]);

	// Pressing the chosen toggle again would clear it; keep one source selected.
	$effect(() => {
		if (from === '') from = 'catalogue';
	});

	// Start fresh each time the modal opens.
	$effect(() => {
		if (open) {
			geojson = null;
			pickedEntry = null;
			from = 'catalogue';
			loadingId = null;
			catalogueError = '';
			catalogueNotice = '';
			name = layer?.name ?? '';
			color = layer?.color ?? defaultColor;
			labelField = layer?.labelField ?? '';
		}
	});

	async function handleUpload(file: File) {
		geojson = await readGeoJSON(file);
		name = file.name.replace(/\.(geo)?json$/i, '');
		sourceLabel = file.name;
		pickedEntry = null;
		labelField = '';
	}

	async function handlePick(entry: CatalogueEntry) {
		loadingId = entry.id;
		catalogueError = '';
		catalogueNotice = '';
		try {
			const result = await loadCatalogueLayer(entry, getViewBounds?.() ?? null);
			geojson = result.geojson as LayerGeoJSON;
			name = entry.name;
			sourceLabel = entry.publisher;
			pickedEntry = entry;
			labelField = entry.labelField && fields.includes(entry.labelField) ? entry.labelField : '';
			const notes: string[] = [];
			if (result.outsideView) {
				notes.push('Nothing was in the current map view, so the whole layer was loaded and the map will move to it.');
			}
			if (result.truncated) {
				notes.push(
					result.outsideView
						? 'It has more shapes than can be loaded at once, so only the first ones were added.'
						: 'It has more shapes than can be loaded at once, so only the first ones were added. Zoom the map in and add it again for the rest.'
				);
			}
			catalogueNotice = notes.join(' ');
		} catch (e) {
			catalogueError =
				e instanceof CatalogueError ? e.message : 'The layer could not be loaded. Try again later.';
		} finally {
			loadingId = null;
		}
	}

	function back() {
		geojson = null;
		pickedEntry = null;
		catalogueError = '';
		catalogueNotice = '';
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!editing && !geojson) return;
		onSave({
			name: name.trim() || 'Untitled layer',
			color,
			labelField: labelField && fields.includes(labelField) ? labelField : null,
			geojson
		});
		onClose();
	}
</script>

<Dialog.Root
	{open}
	onOpenChange={(next) => {
		if (!next) onClose();
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-4xl -translate-x-1/2 overflow-y-auto -translate-y-1/2 rounded-xl bg-surface p-6 shadow-lg"
		>
			<Dialog.Title class="text-lg font-semibold text-on-surface">
				{editing ? 'Edit Layer' : 'Add Layer'}
			</Dialog.Title>

			{#if step === 'source'}
				<div class="mt-4 flex flex-col gap-4">
					<ToggleGroup
						label="Add from"
						hideLabel
						bind:value={from}
						items={[
							{ value: 'catalogue', label: 'Catalogue' },
							{ value: 'file', label: 'Local File' }
						]}
					/>
					{#if from === 'file'}
						<FileDropzone format="geojson" onUpload={handleUpload} />
					{:else}
						<LayerCatalogue {loadingId} {getViewBounds} onPick={handlePick} />
						{#if catalogueError}
							<p role="alert" class="text-sm text-error">{catalogueError}</p>
						{/if}
					{/if}
				</div>
				<div class="mt-6 flex justify-end">
					<Button variant="ghost" onclick={onClose}>Cancel</Button>
				</div>
			{:else}
				<form onsubmit={submit}>
					<div class="mt-4 flex flex-wrap items-center gap-2">
						{#each kinds as { kind, count } (kind)}
							<GeometryBadge {kind} {count} />
						{:else}
							<span class="text-sm text-on-surface-subtle">No shapes</span>
						{/each}
						{#if !editing}
							{#if pickedEntry}
								<SourceBadge
									provider={pickedEntry.provider}
									publisher={pickedEntry.publisher}
									href={pickedEntry.sourceUrl}
								/>
								{#if pickedEntry.official}
									<OfficialBadge />
								{/if}
							{:else}
								<span class="text-sm text-on-surface-subtle">From {sourceLabel}</span>
							{/if}
						{/if}
					</div>
					{#if !editing}
						{#if catalogueNotice}
							<p role="status" class="mt-1 text-sm text-on-surface-subtle">{catalogueNotice}</p>
						{/if}
					{/if}
					<div class="mt-4 flex flex-col gap-4">
						<FormField label="Layer name">
							<TextInput bind:value={name} placeholder="Untitled layer" />
						</FormField>
						<FormField
							id="layer-label-field"
							label="Label field"
							helperText={fields.length
								? 'The property shown on each shape, such as a ward number.'
								: 'This layer has no properties to label with.'}
						>
							<Dropdown
								id="layer-label-field"
								bind:value={labelField}
								items={labelItems}
								disabled={fields.length === 0}
								class="w-full"
							/>
						</FormField>
						<div class="flex flex-col gap-2">
							<span class="text-sm font-medium text-on-surface">Color</span>
							<ColorSwatchPicker value={color} label="Layer color" onChange={(next) => (color = next)} />
						</div>
					</div>

					<div class="mt-6 flex items-center justify-between gap-2">
						{#if editing}
							<span></span>
						{:else}
							<Button variant="ghost" onclick={back}>Back</Button>
						{/if}
						<div class="flex gap-2">
							<Button variant="ghost" onclick={onClose}>Cancel</Button>
							<Button type="submit">{editing ? 'Save' : 'Add layer'}</Button>
						</div>
					</div>
				</form>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
