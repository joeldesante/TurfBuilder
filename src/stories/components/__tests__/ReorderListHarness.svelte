<script lang="ts">
	import ReorderList from '$components/layout/reorder-list/ReorderList.svelte';

	interface Props {
		ids: string[];
		onReorder?: (ids: string[]) => void | Promise<void>;
		/** Set false to render the list without an onReorder. */
		withReorder?: boolean;
	}

	const { ids, onReorder = () => {}, withReorder = true }: Props = $props();
</script>

<ReorderList {ids} onReorder={withReorder ? onReorder : undefined}>
	{#snippet item(id)}
		Item {id}
	{/snippet}
</ReorderList>
