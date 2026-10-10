<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import RadiusPickerModal from './RadiusPickerModal.svelte';

	const { Story } = defineMeta({
		title: 'Components/Universe/RadiusPickerModal',
		component: RadiusPickerModal,
		args: { open: true, onOpenChange: () => {}, onapply: () => {} }
	});
</script>

<Story name="Empty" />

<Story
	name="With Existing Area"
	args={{ value: { latitude: 40.0259, longitude: -75.2238, radius: 2 } }}
/>
