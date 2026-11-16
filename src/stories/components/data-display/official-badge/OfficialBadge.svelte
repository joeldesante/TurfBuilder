<script lang="ts">
	import SealCheckIcon from 'phosphor-svelte/lib/SealCheck';
	import Tooltip from '$components/feedback/tooltip/Tooltip.svelte';

	/**
	 * A small mark for a layer that comes from a government's own data portal. Hovering or
	 * focusing it explains what counts as official.
	 */
</script>

<Tooltip side="top">
	{#snippet trigger(props)}
		<span
			{...props}
			tabindex="0"
			role="note"
			aria-label="Official source"
			class="inline-flex cursor-help items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-medium text-success outline-none focus-visible:ring-2 focus-visible:ring-primary"
		>
			<SealCheckIcon class="size-3.5" weight="fill" />
			Official
		</span>
	{/snippet}
	{#snippet content()}
		Published by a government agency or through its official data portal, such as a city, county,
		state, tribal or federal agency. Layers republished by universities, companies, non-profits or
		individuals elsewhere are not marked official.
	{/snippet}
</Tooltip>
