<script lang="ts">
	import { motion } from 'motion-sv';

	export interface Tab {
		id: string;
		label: string;
		href: string;
		/** Shown after the label, such as how many rows the tab holds. */
		count?: number;
	}

	interface Props {
		tabs: Tab[];
		/** The id of the tab being shown. */
		active: string;
		/** Names the tab list for screen readers. */
		label: string;
		class?: string;
	}

	let { tabs, active, label, class: className = '' }: Props = $props();

	// Names this group's sliding pill, so two groups on one page do not share it.
	const uid = $props.id();
	const pillId = `tabs-pill-${uid}`;
</script>

<nav aria-label={label} class="max-w-full {className}">
	<ul class="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-container p-1">
		{#each tabs as tab (tab.id)}
			{@const current = tab.id === active}
			<li class="shrink-0">
				<a
					href={tab.href}
					aria-current={current ? 'page' : undefined}
					data-sveltekit-noscroll
					class="relative flex items-center rounded-full px-4 py-1 text-sm no-underline transition-colors hover:no-underline {current
						? 'font-medium text-on-surface'
						: 'text-on-surface-subtle hover:text-on-surface'}"
				>
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
				</a>
			</li>
		{/each}
	</ul>
</nav>
