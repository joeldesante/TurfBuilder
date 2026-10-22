<script lang="ts">
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
</script>

<nav aria-label={label} class="border-b border-outline-subtle {className}">
	<ul class="-mb-px flex gap-1 overflow-x-auto">
		{#each tabs as tab (tab.id)}
			{@const current = tab.id === active}
			<li class="shrink-0">
				<a
					href={tab.href}
					aria-current={current ? 'page' : undefined}
					data-sveltekit-noscroll
					class="flex items-center gap-2 border-b-2 px-3 py-2 text-sm no-underline transition-colors {current
						? 'border-primary font-medium text-on-surface'
						: 'border-transparent text-on-surface-subtle hover:text-on-surface'}"
				>
					{tab.label}
					{#if tab.count !== undefined}
						<span class="rounded-full bg-surface-container px-2 text-xs tabular-nums text-on-surface-subtle"
							>{tab.count.toLocaleString()}</span
						>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>
