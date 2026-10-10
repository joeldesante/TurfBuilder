<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PolygonPickerModal from './PolygonPickerModal.svelte';

	const { Story } = defineMeta({
		title: 'Components/Universe/PolygonPickerModal',
		component: PolygonPickerModal,
		args: { open: true, onOpenChange: () => {}, onapply: () => {} }
	});

	const triangle: GeoJSON.Polygon = {
		type: 'Polygon',
		coordinates: [
			[
				[-75.25, 40.0],
				[-75.2, 40.05],
				[-75.15, 40.0],
				[-75.25, 40.0]
			]
		]
	};
</script>

<Story name="Empty" />

<Story name="With Existing Region" args={{ value: triangle }} />
