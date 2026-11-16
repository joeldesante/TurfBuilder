<script lang="ts">
	import CheckIcon from 'phosphor-svelte/lib/Check';
	import { LAYER_COLORS } from '$lib/shared/utils/layer-colors';

	/** A row of color circles to choose one color from a fixed list. */
	interface Props {
		/** The chosen color, as a hex value from `colors`. */
		value: string;
		/** Names the group for screen readers. @default 'Color' */
		label?: string;
		colors?: readonly { name: string; value: string }[];
		onChange: (value: string) => void;
	}

	const { value, label = 'Color', colors = LAYER_COLORS, onChange }: Props = $props();
</script>

<div role="radiogroup" aria-label={label} class="flex flex-wrap gap-2">
	{#each colors as color (color.value)}
		{@const selected = color.value === value}
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			aria-label={color.name}
			title={color.name}
			onclick={() => onChange(color.value)}
			class="flex size-7 items-center justify-center rounded-full text-white outline-none ring-offset-2 ring-offset-surface focus-visible:ring-2 focus-visible:ring-primary {selected
				? 'ring-2 ring-on-surface'
				: 'hover:scale-110'}"
			style="background-color: {color.value};"
		>
			{#if selected}
				<CheckIcon class="size-4" weight="bold" />
			{/if}
		</button>
	{/each}
</div>
