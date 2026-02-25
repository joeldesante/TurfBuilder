<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import MapMarker, { type Variant } from './MapMarker.svelte';

	const allVariants: Variant[] = ['unvisited', 'contacted', 'no-contact', 'hostile'];

	const { Story } = defineMeta({
		title: 'Components/Data Display/Map Marker',
		component: MapMarker,
		tags: ['autodocs'],
		argTypes: {
			variant: {
				control: { type: 'select' },
				options: ['unvisited', 'contacted', 'no-contact', 'hostile'],
				description: 'The canvassing status of the location.'
			},
			isSelected: {
				control: 'boolean',
				description: 'Scales the pin up to indicate it is the currently selected marker on the map.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					'A map pin marker indicating the canvassing status of a location. Designed for use with MapLibre GL via Svelte mount().'
			}
		}
	});
</script>

<Story name="Unvisited" args={{ variant: 'unvisited' }} />

<Story name="Contacted" args={{ variant: 'contacted' }} />

<Story name="No Contact" args={{ variant: 'no-contact' }} />

<Story name="Hostile" args={{ variant: 'hostile' }} />

<Story name="Selected" args={{ variant: 'unvisited', isSelected: true }} />

<Story name="All Variants" asChild>
	<div class="flex items-end gap-6 p-8">
		<MapMarker variant="unvisited" />
		<MapMarker variant="contacted" />
		<MapMarker variant="no-contact" />
		<MapMarker variant="hostile" />
	</div>
</Story>

<Story name="Selected vs Unselected" asChild>
	<div class="flex items-end gap-10 p-8">
		<div class="flex flex-col items-center gap-4">
			<MapMarker variant="unvisited" />
			<span class="text-xs text-on-surface-subtle">Default</span>
		</div>
		<div class="flex flex-col items-center gap-4">
			<MapMarker variant="unvisited" isSelected />
			<span class="text-xs text-on-surface-subtle">Selected</span>
		</div>
	</div>
</Story>

<Story name="Gallery" asChild>
	<div class="grid grid-cols-4 gap-8 p-8">
		{#each allVariants as variant (variant)}
			<div class="flex flex-col items-center gap-4">
				<div class="flex items-end gap-4">
					<MapMarker {variant} />
					<MapMarker {variant} isSelected />
				</div>
				<span class="text-xs text-on-surface-subtle capitalize">{variant}</span>
			</div>
		{/each}
	</div>
</Story>
