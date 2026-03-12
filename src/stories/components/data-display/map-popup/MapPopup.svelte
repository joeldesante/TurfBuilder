<script lang="ts">
	interface Props {
		locationName: string;
		street?: string | null;
		locality?: string | null;
	}

	let { locationName, street = null, locality = null }: Props = $props();
</script>

<div class="flex flex-col gap-0.5 py-0.5 pr-6">
	<span class="font-semibold text-on-surface leading-snug">{locationName}</span>
	{#if street || locality}
		<span class="text-xs text-on-surface-subtle">
			{[street, locality].filter(Boolean).join(', ')}
		</span>
	{/if}
</div>
