<script lang="ts">
	import DotsSixVerticalIcon from 'phosphor-svelte/lib/DotsSixVertical';

	interface Props {
		ondragstart: (event: DragEvent) => void;
		ondragend?: (event: DragEvent) => void;
	}

	const { ondragstart, ondragend }: Props = $props();
</script>

<!-- Only the grip starts a drag, so the inputs inside a card stay selectable. -->
<button
	type="button"
	draggable="true"
	aria-label="Drag to reorder"
	class="inline-flex shrink-0 cursor-grab touch-none items-center text-on-surface-subtle hover:text-on-surface active:cursor-grabbing"
	{ondragstart}
	{ondragend}
>
	<DotsSixVerticalIcon size={20} />
</button>
