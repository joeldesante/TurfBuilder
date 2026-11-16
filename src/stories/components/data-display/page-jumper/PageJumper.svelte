<script lang="ts">
	import { motion } from 'motion-sv';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeft';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRight';
	import Tooltip from '$components/feedback/tooltip/Tooltip.svelte';

	/**
	 * A small row of page buttons for jumping around a long list. At most
	 * `visible` buttons show; with more pages than that, the row is a carousel
	 * that slides to keep the current page in the middle (or at the edge when
	 * it is near the start or end). Chevrons either side step one page at a time,
	 * and hovering a page says where it jumps to.
	 */
	interface Props {
		/** How many pages there are. Nothing shows for fewer than two. */
		pageCount: number;
		/** The selected page, counting from 0. */
		current: number;
		/** Called with the page (from 0) that was chosen. */
		onSelect: (page: number) => void;
		/**
		 * The position a page jumps to, named in its tooltip ("Jump to 1,000"). The button shows the
		 * page number. The first page is called "Top" instead, whatever position it names.
		 */
		startOf: (page: number) => number;
		/** How many buttons show at once. @default 5 */
		visible?: number;
		/**
		 * `large` makes every button a finger-sized 44px target with bigger numbers, for touch
		 * screens. @default 'default'
		 */
		size?: 'default' | 'large';
		/** Names the group for screen readers. @default 'Jump to a section' */
		label?: string;
		class?: string;
	}

	const {
		pageCount,
		current,
		onSelect,
		startOf,
		visible = 5,
		size = 'default',
		label = 'Jump to a section',
		class: className = ''
	}: Props = $props();

	/** Width of one button slot, in pixels. 44 is the usual smallest comfortable target for a finger. */
	const SLOT = $derived(size === 'large' ? 44 : 40);
	/** The chevrons, the same height as a slot in the large size. */
	const chevronSize = $derived(size === 'large' ? 'size-11' : 'size-8');
	const numberSize = $derived(size === 'large' ? 'text-sm' : 'text-xs');

	/** What a page button is called, in its tooltip and to screen readers: "Jump to Top", then "Jump to 1,000". */
	const nameOf = (page: number) =>
		page === 0 ? 'Jump to Top' : `Jump to ${startOf(page).toLocaleString()}`;

	const shown = $derived(Math.min(visible, pageCount));
	/** The first page in view: the current one centered, held inside the ends. */
	const start = $derived(Math.max(0, Math.min(pageCount - shown, current - Math.floor(shown / 2))));
	/** One extra page each side is drawn (and clipped) so it slides in rather than popping in. */
	const first = $derived(Math.max(0, start - 1));
	const last = $derived(Math.min(pageCount - 1, start + shown));
	const pages = $derived(Array.from({ length: last - first + 1 }, (_, i) => first + i));
</script>

{#if pageCount > 1}
	<nav
		aria-label={label}
		class="pointer-events-auto flex items-center gap-0.5 rounded-full border border-outline-subtle bg-surface/95 p-1 shadow-sm backdrop-blur-sm {className}"
	>
		{@render chevron('Previous section', current - 1, current <= 0)}
		<div class="relative overflow-hidden" style:width="{shown * SLOT}px" style:height="{SLOT}px">
			{#each pages as page (page)}
				<!-- The motion element only slides; the plain button inside is the tooltip's trigger,
				     because motion does not pass on what the tooltip needs to find its trigger. -->
				<motion.div
					initial={false}
					animate={{ x: (page - start) * SLOT }}
					transition={{ type: 'spring', bounce: 0.1, duration: 0.45 }}
					class="absolute top-0 left-0"
					style={{ width: `${SLOT}px`, height: `${SLOT}px` }}
				>
					<Tooltip side="top" text={nameOf(page)}>
						{#snippet trigger(props)}
							<button
								{...props}
								type="button"
								aria-label={nameOf(page)}
								aria-current={page === current ? 'true' : undefined}
								class="flex size-full cursor-pointer touch-manipulation items-center justify-center rounded-full {numberSize} tabular-nums transition-colors duration-200 {page ===
								current
									? 'bg-primary text-on-primary'
									: 'text-on-surface-subtle hover:bg-surface-container'}"
								onclick={(event) => {
									(props.onclick as ((e: MouseEvent) => void) | undefined)?.(event);
									onSelect(page);
								}}
							>
								{page}
							</button>
						{/snippet}
					</Tooltip>
				</motion.div>
			{/each}
		</div>
		{@render chevron('Next section', current + 1, current >= pageCount - 1)}
	</nav>
{/if}

{#snippet chevron(name: string, target: number, disabled: boolean)}
	<button
		type="button"
		aria-label={name}
		{disabled}
		class="flex {chevronSize} shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full text-on-surface-subtle transition-colors duration-200 hover:bg-surface-container disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
		onclick={() => onSelect(target)}
	>
		{#if target < current}<CaretLeftIcon />{:else}<CaretRightIcon />{/if}
	</button>
{/snippet}
