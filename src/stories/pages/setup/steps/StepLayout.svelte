<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		children: Snippet;
	}

	const { title, description, children }: Props = $props();
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-bold text-on-surface">{title}</h1>
		{#if description}
			<p class="text-on-surface-subtle">{description}</p>
		{/if}
	</div>
	{@render children()}
</div>
