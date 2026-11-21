<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ColorSwatchPicker from './ColorSwatchPicker.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/ColorSwatchPicker',
		component: ColorSwatchPicker,
		tags: ['autodocs']
	});
</script>

<Story name="Default" args={{ value: '#2f6fed', onChange: () => {} }} />
