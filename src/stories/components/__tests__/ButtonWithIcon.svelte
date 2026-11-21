<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import TrashIcon from 'phosphor-svelte/lib/Trash';

	/** A Button holding an icon, and a label when it is not icon-only, for tests. */
	const {
		iconOnly = false,
		loading = false,
		size = 'default'
	}: { iconOnly?: boolean; loading?: boolean; size?: 'default' | 'sm' } = $props();
</script>

<Button {iconOnly} {loading} {size} variant="ghost" aria-label="Remove">
	<TrashIcon data-testid="the-icon" />
	{#if !iconOnly}Remove{/if}
</Button>
