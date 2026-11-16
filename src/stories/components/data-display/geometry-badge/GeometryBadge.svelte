<script lang="ts">
	import PolygonIcon from 'phosphor-svelte/lib/Polygon';
	import LineSegmentsIcon from 'phosphor-svelte/lib/LineSegments';
	import MapPinSimpleIcon from 'phosphor-svelte/lib/MapPinSimple';
	import type { GeometryKind } from '$lib/shared/utils/geojson-geometry';

	/** A small tag saying whether a map layer is made of shapes (polygons), lines or points. */
	interface Props {
		kind: GeometryKind;
		/** How many there are, shown after the name. */
		count?: number;
	}

	const { kind, count }: Props = $props();

	const NAMES = { polygon: 'Polygons', line: 'Lines', point: 'Points' } as const;
</script>

<span
	class="inline-flex items-center gap-1 rounded-full border border-outline-subtle bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant"
>
	{#if kind === 'polygon'}
		<PolygonIcon class="size-3.5" />
	{:else if kind === 'line'}
		<LineSegmentsIcon class="size-3.5" />
	{:else}
		<MapPinSimpleIcon class="size-3.5" />
	{/if}
	{NAMES[kind]}{count !== undefined ? ` (${count.toLocaleString('en-US')})` : ''}
</span>
