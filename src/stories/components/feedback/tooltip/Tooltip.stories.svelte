<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Tooltip from './Tooltip.svelte';

	const { Story } = defineMeta({
		title: 'Components/Feedback/Tooltip',
		component: Tooltip,
		tags: ['autodocs'],
		argTypes: {
			side: {
				control: { type: 'select' },
				options: ['top', 'bottom', 'left', 'right']
			}
		}
	});
</script>

<Story name="Default" args={{ text: 'This is a tooltip' }}>
	<span class="underline cursor-default">Hover over me</span>
</Story>

<Story name="Top" args={{ text: 'Tooltip on top', side: 'top' }}>
	<span class="underline cursor-default">Hover over me</span>
</Story>

<Story name="Left" args={{ text: 'Tooltip on left', side: 'left' }}>
	<span class="underline cursor-default">Hover over me</span>
</Story>

<Story name="Right" args={{ text: 'Tooltip on right', side: 'right' }}>
	<span class="underline cursor-default">Hover over me</span>
</Story>
