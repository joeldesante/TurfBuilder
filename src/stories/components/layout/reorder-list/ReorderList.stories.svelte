<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ReorderList from './ReorderList.svelte';

	const { Story } = defineMeta({
		title: 'Components/Layout/Reorder List',
		component: ReorderList,
		tags: ['autodocs'],
		argTypes: { item: { control: false }, onReorder: { control: false } },
		parameters: {
			docs: {
				subtitle:
					'Items that can be dragged into a new order by mouse or touch, with the others sliding out of the way.'
			}
		}
	});
</script>

<Story name="Horizontal">
	{#snippet template()}
		<ReorderList ids={['One', 'Two', 'Three', 'Four']} onReorder={() => {}} class="flex gap-2">
			{#snippet item(id)}
				<span class="block rounded-md border border-outline px-3 py-2 text-sm">{id}</span>
			{/snippet}
		</ReorderList>
	{/snippet}
</Story>

<Story name="Vertical">
	{#snippet template()}
		<ReorderList
			ids={['One', 'Two', 'Three', 'Four']}
			axis="y"
			onReorder={() => {}}
			class="flex w-48 flex-col gap-2"
		>
			{#snippet item(id)}
				<span class="block rounded-md border border-outline px-3 py-2 text-sm">{id}</span>
			{/snippet}
		</ReorderList>
	{/snippet}
</Story>
