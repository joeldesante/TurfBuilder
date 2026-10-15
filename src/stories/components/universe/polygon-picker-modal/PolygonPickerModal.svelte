<script lang="ts">
	import { Dialog } from 'bits-ui';
	import maplibregl from 'maplibre-gl';
	import type { Geoman } from '@geoman-io/maplibre-geoman-free';
	import Button from '$components/actions/button/Button.svelte';
	import { getMapStyle } from '$lib/map-style';
	import XIcon from 'phosphor-svelte/lib/X';

	import 'maplibre-gl/dist/maplibre-gl.css';
	import '@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css';

	interface Props {
		open: boolean;
		/** The region already chosen, if any. */
		value?: GeoJSON.Polygon | null;
		onOpenChange: (open: boolean) => void;
		onapply: (value: GeoJSON.Polygon) => void;
	}

	const { open, value = null, onOpenChange, onapply }: Props = $props();

	let container = $state<HTMLDivElement>();
	let polygon = $state<GeoJSON.Polygon | null>(null);

	// Start from the saved value each time the modal opens, so cancelling discards edits.
	$effect(() => {
		if (open) polygon = value;
	});

	// The map lives only while the dialog content is mounted.
	$effect(() => {
		const element = container;
		if (!element) return;

		let map: maplibregl.Map | undefined;
		let geoman: Geoman | undefined;
		let cancelled = false;

		function readPolygon() {
			if (!geoman) return;
			const drawn = geoman.features
				.getAll()
				.features.filter((f) => f.geometry.type === 'Polygon');
			// The most recently drawn shape wins; Polygon features are always closed rings.
			polygon = drawn.length > 0 ? (drawn[drawn.length - 1].geometry as GeoJSON.Polygon) : null;
		}

		(async () => {
			const dark = document.documentElement.getAttribute('data-theme') === 'dark';
			const [{ Geoman: GeomanClass }, style] = await Promise.all([
				import('@geoman-io/maplibre-geoman-free'),
				getMapStyle(dark)
			]);
			if (cancelled) return;

			map = new maplibregl.Map({
				container: element,
				// @ts-expect-error getMapStyle returns a plain object rather than a StyleSpecification
				style,
				center: [-98.5795, 39.8283],
				zoom: 4,
				attributionControl: { compact: true }
			});

			geoman = new GeomanClass(map, {
				settings: { controlsPosition: 'top-right', controlsUiEnabledByDefault: false },
				controls: {
					draw: { polygon: { uiEnabled: true } },
					edit: {
						drag: { active: false },
						change: { uiEnabled: true },
						delete: { uiEnabled: true }
					},
					helper: { snapping: { uiEnabled: true, active: true } }
				}
			});

			(['gm:create', 'gm:edit', 'gm:remove', 'gm:change'] as const).forEach((event) => {
				map!.on(event as never, () => queueMicrotask(readPolygon));
			});

			const existing = value;
			if (existing) {
				await geoman.waitForGeomanLoaded();
				if (cancelled) return;
				geoman.features.importGeoJson({ type: 'Feature', properties: {}, geometry: existing });
				const [lng, lat] = existing.coordinates[0][0];
				map.jumpTo({ center: [lng, lat], zoom: 10 });
			}
		})();

		return () => {
			cancelled = true;
			map?.remove();
		};
	});
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<!-- preventOverflowTextSelection off: bits-ui would otherwise set user-select: text on the dialog while the mouse is down, overriding select-none. -->
		<Dialog.Content
			preventOverflowTextSelection={false}
			class="fixed left-1/2 top-1/2 z-50 flex h-[36rem] w-[calc(100vw-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface shadow-lg select-none [&_input]:select-text [&_textarea]:select-text"
		>
			<div class="flex items-center justify-between border-b border-outline px-6 py-4">
				<div>
					<Dialog.Title class="text-lg font-semibold text-on-surface">Drawn Region</Dialog.Title>
					<Dialog.Description class="text-sm text-on-surface-subtle">
						Use the polygon tool on the map to draw a closed shape.
					</Dialog.Description>
				</div>
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="sm" iconOnly aria-label="Close">
							<XIcon />
						</Button>
					{/snippet}
				</Dialog.Close>
			</div>

			<div bind:this={container} class="min-h-0 flex-1"></div>

			<div class="flex items-center justify-end gap-2 border-t border-outline px-6 py-4">
				<Button variant="ghost" onclick={() => onOpenChange(false)}>Cancel</Button>
				<Button disabled={!polygon} onclick={() => polygon && onapply(polygon)}>Apply</Button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
