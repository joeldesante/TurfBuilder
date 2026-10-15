<script lang="ts">
	import MapTrifoldIcon from 'phosphor-svelte/lib/MapTrifold';
	import type { SentencePart } from '$lib/shared/utils/filter-sentence';

	interface Props {
		parts: SentencePart[];
		/** Called when the map button beside a viewable setting is pressed. */
		onview?: (kind: NonNullable<SentencePart['view']>) => void;
		/** When given, pressing a setting calls it, so the sentence opens its own editor. */
		onedit?: () => void;
	}

	const { parts, onview, onedit }: Props = $props();

	const badgeBase = 'inline-block rounded-md px-2 py-0.5 font-semibold max-sm:leading-5';

	// A pressable setting tints toward its text color on hover: darker in light mode, lighter in dark.
	const badgeColors = (incomplete?: boolean) =>
		incomplete
			? 'bg-warning-container text-on-warning-container'
			: 'bg-primary-container text-on-primary-container';
	const badgeHover = (incomplete?: boolean) =>
		'cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-primary ' +
		(incomplete
			? 'hover:bg-[color-mix(in_srgb,var(--warning-container),var(--on-warning-container)_12%)]'
			: 'hover:bg-[color-mix(in_srgb,var(--primary-container),var(--on-primary-container)_12%)]');

	/** The sentence split into its clauses at the break parts. */
	const clauses = $derived(
		parts.reduce<SentencePart[][]>(
			(all, part) => {
				if (part.break) all.push([]);
				else all[all.length - 1].push(part);
				return all;
			},
			[[]]
		)
	);
</script>

<!--
	One line that scrolls sideways when it is too long, rather than wrapping. On a
	phone most of the line would be out of view, so there each clause starts its
	own line and wraps.
-->
<p
	class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-1 text-sm text-on-surface max-sm:whitespace-normal max-sm:leading-7"
>
	{#each clauses as clause, c (c)}{#if c > 0}{' '}{/if}<span class="max-sm:block"
			>{#each clause as part, i (i)}{#if part.badge}{#if onedit}<button
							type="button"
							tabindex="-1"
							class="{badgeBase} {badgeColors(part.incomplete)} {badgeHover(part.incomplete)}"
							onclick={onedit}>{part.text}</button
						>{:else}<span class="{badgeBase} {badgeColors(part.incomplete)}">{part.text}</span
						>{/if}{#if part.view && onview}<button
							type="button"
							class="ml-1 inline-flex size-6 cursor-pointer items-center justify-center rounded align-middle text-on-surface-subtle hover:bg-surface-container hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
							aria-label="View on map"
							onclick={() => onview(part.view!)}><MapTrifoldIcon size={16} /></button
						>{/if}{:else}<span>{part.text}</span>{/if}{/each}</span
		>{/each}
</p>
