<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Separator from './Separator.svelte';

	const { Story } = defineMeta({
		title: 'Components/Layout/Separator',
		component: Separator,
		tags: ['autodocs'],
		argTypes: {
			orientation: {
				control: 'radio',
				options: ['horizontal', 'vertical'],
				description: 'Direction of the separator line.'
			},
			decorative: {
				control: 'boolean',
				description:
					'When true the separator is purely visual and hidden from assistive technology.'
			}
		},
		parameters: {
			docs: {
				subtitle: 'A thin rule that visually divides content, horizontal or vertical.'
			}
		}
	});
</script>

<Story name="Horizontal" args={{ orientation: 'horizontal' }}>
	{#snippet template(args)}
		<div class="w-64 py-4">
			<p class="text-sm mb-2">Above</p>
			<Separator {...args} />
			<p class="text-sm mt-2">Below</p>
		</div>
	{/snippet}
</Story>

<Story name="Vertical" args={{ orientation: 'vertical' }}>
	{#snippet template(args)}
		<div class="flex h-8 items-center gap-4 text-sm">
			Left
			<Separator {...args} />
			Right
		</div>
	{/snippet}
</Story>
