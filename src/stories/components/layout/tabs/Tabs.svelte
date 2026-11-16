<script lang="ts">
	import { motion } from 'motion-sv';

	export interface Tab {
		id: string;
		label: string;
		/** Where the tab goes. Without it the tab is a button that calls `onSelect`, for tabs that switch a part of the page. */
		href?: string;
		/** Shown after the label, such as how many rows the tab holds. */
		count?: number;
	}

	interface Props {
		tabs: Tab[];
		/** The id of the tab being shown. */
		active: string;
		/** Names the tab list for screen readers. */
		label: string;
		/** Called with the tab's id when a tab without an `href` is pressed. */
		onSelect?: (id: string) => void;
		class?: string;
	}

	let { tabs, active, label, onSelect, class: className = '' }: Props = $props();

	// Names this group's sliding pill, so two groups on one page do not share it.
	const uid = $props.id();
	const pillId = `tabs-pill-${uid}`;

	const tabClass = (current: boolean) =>
		`relative flex cursor-pointer items-center rounded-full px-4 py-1 text-sm no-underline transition-colors hover:no-underline ${
			current ? 'font-medium text-on-surface' : 'text-on-surface-subtle hover:text-on-surface'
		}`;
</script>

{#snippet content(tab: Tab, current: boolean)}
	{#if current}
		<!-- One element shared by every tab: motion slides it to the new current tab. -->
		<motion.span
			layoutId={pillId}
			data-tabs-pill
			class="absolute inset-0 rounded-full bg-surface shadow-sm"
			transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
		/>
	{/if}
	<span class="relative flex items-center gap-2">
		{tab.label}
		{#if tab.count !== undefined}
			<span
				class="rounded-full bg-surface-container px-2 text-xs tabular-nums text-on-surface-subtle"
				>{tab.count.toLocaleString()}</span
			>
		{/if}
	</span>
{/snippet}

<nav aria-label={label} class="max-w-full {className}">
	<ul class="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-container p-1">
		{#each tabs as tab (tab.id)}
			{@const current = tab.id === active}
			<li class="shrink-0">
				{#if tab.href}
					<a
						href={tab.href}
						aria-current={current ? 'page' : undefined}
						data-sveltekit-noscroll
						class={tabClass(current)}
					>
						{@render content(tab, current)}
					</a>
				{:else}
					<button
						type="button"
						aria-current={current ? 'true' : undefined}
						onclick={() => onSelect?.(tab.id)}
						class={tabClass(current)}
					>
						{@render content(tab, current)}
					</button>
				{/if}
			</li>
		{/each}
	</ul>
</nav>
