<script lang="ts">
	import LayeredMap, {
		type MapLayer
	} from '$components/data-display/layered-map/LayeredMap.svelte';
	import Spinner from '$components/feedback/spinner/Spinner.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircle';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircle';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeft';
	import DatabaseIcon from 'phosphor-svelte/lib/Database';
	import SpinnerGapIcon from 'phosphor-svelte/lib/SpinnerGap';

	export interface ImportResult {
		imported: number;
		skipped: number;
		errors: { row: number; reason: string }[];
	}

	export type ImportProgress =
		| { stage: 'querying'; message?: string }
		| { stage: 'uploading'; batch: number; total: number }
		| { stage: 'done'; result: ImportResult };

	interface Props {
		orgSlug: string;
		layers: Promise<MapLayer[]> | MapLayer[];
		onImport: (geometries: GeoJSON.Geometry[]) => AsyncIterable<ImportProgress>;
	}

	const { orgSlug, layers, onImport }: Props = $props();

	let selectedGeometries = $state<GeoJSON.Geometry[]>([]);
	let importing = $state(false);
	let progressMessage = $state('');
	let result = $state<ImportResult | null>(null);
	let importError = $state<string | null>(null);

	async function handleImport() {
		if (selectedGeometries.length === 0 || importing) return;
		importing = true;
		result = null;
		importError = null;

		try {
			for await (const progress of onImport($state.snapshot(selectedGeometries))) {
				if (progress.stage === 'querying') {
					progressMessage = progress.message ?? 'Querying Overture data...';
				} else if (progress.stage === 'uploading') {
					progressMessage = `Uploading batch ${progress.batch} of ${progress.total}...`;
				} else if (progress.stage === 'done') {
					result = progress.result;
				}
			}
		} catch (err) {
			importError = err instanceof Error ? err.message : 'An unexpected error occurred.';
		} finally {
			importing = false;
			progressMessage = '';
		}
	}
</script>

<div class="h-dvh w-screen">
	{#await layers}
		<div class="flex h-full w-full items-center justify-center gap-2" role="status">
			<Spinner />
			<span class="text-on-surface-subtle text-sm">Loading map layers...</span>
		</div>
	{:then resolvedLayers}
		<LayeredMap
			layers={resolvedLayers}
			onSelectedGeometriesChange={(geometries) => (selectedGeometries = geometries)}
		/>
	{:catch error}
		<div class="flex h-full w-full items-center justify-center">
			<p class="text-error text-sm" role="alert">
				{error instanceof Error ? error.message : 'Failed to load map layers.'}
			</p>
		</div>
	{/await}
</div>

<div
	class="absolute top-4 left-4 z-10 w-80 rounded-xl border border-outline bg-surface/90 backdrop-blur-md p-5 space-y-4 shadow-lg"
>
	<div class="flex items-center gap-3">
		<div class="flex items-center justify-center rounded-lg bg-primary/10 p-2">
			<DatabaseIcon class="size-5 text-primary" />
		</div>
		<div>
			<h1 class="text-sm font-semibold text-on-surface">Overture Import</h1>
			<p class="text-xs text-on-surface-subtle">Businesses from Overture Maps</p>
		</div>
	</div>

	{#if result}
		<div
			class="rounded-lg border border-outline bg-surface-container-low p-3 flex items-start gap-2.5 text-sm"
			role="status"
			aria-live="polite"
		>
			<CheckCircleIcon class="size-4 text-green-600 mt-0.5 shrink-0" />
			<div>
				<p class="font-medium text-on-surface text-xs">
					{result.imported.toLocaleString()} imported{#if result.skipped > 0}, {result.skipped.toLocaleString()}
						skipped{/if}
				</p>
				{#if result.errors.length > 0}
					<ul class="mt-1 space-y-0.5 text-on-surface-subtle text-xs">
						{#each result.errors.slice(0, 3) as err}
							<li>Row {err.row}: {err.reason}</li>
						{/each}
						{#if result.errors.length > 3}
							<li>...and {result.errors.length - 3} more</li>
						{/if}
					</ul>
				{/if}
			</div>
		</div>
	{/if}

	{#if importError}
		<div
			class="rounded-lg border border-error/30 bg-error/5 p-3 flex items-start gap-2.5 text-xs"
			role="alert"
		>
			<WarningCircleIcon class="size-4 text-error mt-0.5 shrink-0" />
			<p class="text-error">{importError}</p>
		</div>
	{/if}

	{#if importing}
		<div class="flex items-center gap-2 text-xs text-on-surface-subtle">
			<SpinnerGapIcon class="size-4 animate-spin shrink-0" />
			<span>{progressMessage}</span>
		</div>
	{:else if selectedGeometries.length > 0}
		<p class="text-xs text-on-surface-subtle">
			{selectedGeometries.length}
			{selectedGeometries.length === 1 ? 'area' : 'areas'} selected. Click Import to fetch businesses
			from Overture Maps for the selected region.
		</p>
	{:else}
		<p class="text-xs text-on-surface-subtle">
			Turn on a layer using the layers panel, then click areas on the map to select them.
			Businesses within the selected areas will be imported from Overture Maps.
		</p>
	{/if}

	<div class="flex flex-col gap-2">
		<Button
			disabled={selectedGeometries.length === 0 || importing}
			loading={importing}
			onclick={handleImport}
		>
			<DatabaseIcon />
			Import Businesses
		</Button>
		<a
			href="/o/{orgSlug}/s/universe/data/locations"
			class="flex items-center gap-1 text-xs text-on-surface-subtle hover:text-on-surface transition-colors"
		>
			<CaretLeftIcon class="size-3.5" />
			Back to Locations
		</a>
	</div>
</div>
