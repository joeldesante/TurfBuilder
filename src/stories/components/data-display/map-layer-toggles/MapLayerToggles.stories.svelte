<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import MapLayerToggles, { type ToggleLayer } from './MapLayerToggles.svelte';
	import { LAYER_COLORS } from '$lib/shared/utils/layer-colors';

	const { Story } = defineMeta({
		title: 'Components/Data Display/Map Layer Toggles',
		component: MapLayerToggles,
		tags: ['autodocs'],
		parameters: {
			docs: {
				subtitle: 'The floating layer list on MapView. Turn layers on and off; long lists scroll and can be searched.'
			}
		}
	});

	const few: ToggleLayer[] = [
		{ id: 'wards', name: 'Wards', color: '#2f6fed' },
		{ id: 'parks', name: 'Parks', color: '#2a9d4b' },
		{ id: 'schools', name: 'School catchments', color: '#f4801f' }
	];

	const many: ToggleLayer[] = Array.from({ length: 300 }, (_, i) => ({
		id: `l${i}`,
		name: i % 3 ? `Precinct ${i + 1}` : `Ward ${i + 1}`,
		color: LAYER_COLORS[i % LAYER_COLORS.length].value
	}));
</script>

<script lang="ts">
	let off = $state<Record<string, boolean>>({});
	const isOn = (layer: ToggleLayer) => !off[layer.id];
	const onToggle = (ids: string[], on: boolean) => {
		for (const id of ids) off[id] = !on;
	};
</script>

<Story name="Few Layers">
	{#snippet template()}
		<div class="flex h-[420px] justify-end bg-surface-container p-3">
			<MapLayerToggles layers={few} {isOn} {onToggle} open />
		</div>
	{/snippet}
</Story>

<Story name="Hundreds Of Layers">
	{#snippet template()}
		<div class="flex h-[420px] justify-end bg-surface-container p-3">
			<MapLayerToggles layers={many} {isOn} {onToggle} open />
		</div>
	{/snippet}
</Story>
