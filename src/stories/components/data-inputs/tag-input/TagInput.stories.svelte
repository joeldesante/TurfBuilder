<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TagInput from './TagInput.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/TagInput',
		component: TagInput,
		tags: ['autodocs']
	});
</script>

<Story
	name="Empty"
	args={{
		tags: [],
		placeholder: 'Type and press Enter…',
		onchange: () => {}
	}}
/>

<Story
	name="With Tags"
	args={{
		tags: ['https://turfbuilder.org', 'https://www.turfbuilder.org'],
		placeholder: 'Type and press Enter…',
		onchange: () => {}
	}}
/>

<Story
	name="Disabled"
	args={{
		tags: ['https://turfbuilder.org'],
		disabled: true,
		onchange: () => {}
	}}
/>
