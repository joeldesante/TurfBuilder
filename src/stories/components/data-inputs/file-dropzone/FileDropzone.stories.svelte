<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FileDropzone from './FileDropzone.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/FileDropzone',
		component: FileDropzone,
		tags: ['autodocs']
	});
</script>

<Story name="Default" />

<Story name="Disabled" args={{ disabled: true }} />
