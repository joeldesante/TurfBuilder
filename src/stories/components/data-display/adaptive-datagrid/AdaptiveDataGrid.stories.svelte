<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AdaptiveDataGrid from './AdaptiveDataGrid.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Display/Adaptive Data Grid',
		component: AdaptiveDataGrid,
		tags: ['autodocs'],
		argTypes: {}
	});
</script>

<Story name="Default" />
