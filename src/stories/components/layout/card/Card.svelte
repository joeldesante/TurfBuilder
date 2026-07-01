<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();
</script>

<div
	class="
		rounded
		p-4
		bg-surface-container
		flex
		justify-center
		items-center
		shadow-sm
	"
>
	{@render children()}
</div>
