<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import '@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css';
	import { themeStore } from '$lib/theme.svelte';
	import { getMapStyle } from '$lib/map-style';
	import Button from '$components/actions/button/Button.svelte';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircle';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircle';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeft';
	import DatabaseIcon from 'phosphor-svelte/lib/Database';
	import SpinnerGapIcon from 'phosphor-svelte/lib/SpinnerGap';
	import type { Geoman } from '@geoman-io/maplibre-geoman-free';

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
		onImport: (polygon: GeoJSON.Polygon) => Promise<void>;
	}

	const { orgSlug, onImport }: Props = $props();

	let mapContainer: HTMLDivElement;
	let map: maplibregl.Map;
	let geoman: Geoman | undefined;

	let drawnPolygon = $state<GeoJSON.Polygon | null>(null);
	let importing = $state(false);
	let progressMessage = $state('');
	let result = $state<ImportResult | null>(null);
	let importError = $state<string | null>(null);

	function isDarkTheme() {
		return document.documentElement.getAttribute('data-theme') === 'dark';
	}

	function updateDrawnPolygon() {
		if (!geoman) return;
		const all = (geoman as Geoman).features.getAll();
		const polygons = all.features.filter(
			(f) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
		);
		drawnPolygon =
			polygons.length > 0 ? (polygons[polygons.length - 1].geometry as GeoJSON.Polygon) : null;
	}

	async function handleImport() {
		if (!drawnPolygon || importing) return;
		importing = true;
		result = null;
		importError = null;

		try {
			const gen = onImport(drawnPolygon);
			for await (const progress of gen) {
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

	onMount(() => {
		(async () => {
			const [{ Geoman: GeomanClass }, style] = await Promise.all([
				import('@geoman-io/maplibre-geoman-free'),
				getMapStyle(isDarkTheme())
			]);

			map = new maplibregl.Map({
				container: mapContainer,
				// @ts-ignore
				style,
				center: [-98.5795, 39.8283],
				zoom: 4,
				attributionControl: { compact: true }
			});

			geoman = new GeomanClass(map, {
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
						snapping: { uiEnabled: true, active: true }
					}
				}
			});

			(['gm:create', 'gm:edit', 'gm:remove', 'gm:change'] as const).forEach((evt) => {
				map.on(evt as any, () => queueMicrotask(updateDrawnPolygon));
			});
		})();
	});

	$effect(() => {
		const _ = themeStore.theme;
		if (map) {
			// @ts-ignore
			getMapStyle(isDarkTheme()).then((s) => map.setStyle(s));
		}
	});

	onDestroy(() => {
		map?.remove();
	});
</script>

<div bind:this={mapContainer} class="w-screen h-screen"></div>

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
	{:else if drawnPolygon}
		<p class="text-xs text-on-surface-subtle">
			Area selected. Click Import to fetch businesses from Overture Maps for this region.
		</p>
	{:else}
		<p class="text-xs text-on-surface-subtle">
			Use the polygon tool on the map to draw an area. Businesses within that area will be imported
			from Overture Maps.
		</p>
	{/if}

	<div class="flex flex-col gap-2">
		<Button disabled={!drawnPolygon || importing} loading={importing} onclick={handleImport}>
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
