<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LayerDialog from './LayerDialog.svelte';

	const { Story } = defineMeta({
		title: 'Components/Feedback/LayerDialog',
		component: LayerDialog,
		tags: ['autodocs']
	});
</script>

<Story name="Add" args={{ open: true, onSave: () => {}, onClose: () => {} }} />

<Story
	name="Edit"
	args={{
		open: true,
		layer: {
			name: 'Wards',
			color: '#2a9d4b',
			labelField: 'ward_num',
			geojson: {
				type: 'FeatureCollection',
				features: [{ type: 'Feature', geometry: null, properties: { ward_num: 1, name: 'First' } }]
			}
		},
		onSave: () => {},
		onClose: () => {}
	}}
/>
