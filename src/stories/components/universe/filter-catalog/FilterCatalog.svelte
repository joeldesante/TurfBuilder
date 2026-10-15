<script lang="ts" module>
	import type { FilterCategory, FilterRegistryEntry } from '$lib/shared/types/filter-registry';

	export type { FilterCategory };

	export interface Props {
		open: boolean;
		/** Filters to offer. Defaults to the full shared registry. */
		filters?: FilterRegistryEntry[];
		onOpenChange: (open: boolean) => void;
		onselect?: (filter: FilterRegistryEntry) => void;
		/** When given, the catalog also offers a Filter Group to nest filters in. */
		onselectgroup?: () => void;
	}
</script>

<script lang="ts">
	import type { Component } from 'svelte';
	import { Dialog } from 'bits-ui';
	import Button from '$components/actions/button/Button.svelte';
	import SidebarItem from '$components/layout/fragments/sidebar/SidebarItem.svelte';
	import ClipboardTextIcon from 'phosphor-svelte/lib/ClipboardText';
	import DoorOpenIcon from 'phosphor-svelte/lib/DoorOpen';
	import MapPinIcon from 'phosphor-svelte/lib/MapPin';
	import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFour';
	import TagIcon from 'phosphor-svelte/lib/Tag';
	import TreeStructureIcon from 'phosphor-svelte/lib/TreeStructure';
	import XIcon from 'phosphor-svelte/lib/X';

	import { FILTER_CATEGORIES, getFilters, sortFilters } from '$lib/shared/utils/filter-registry';

	const { open, filters = getFilters(), onOpenChange, onselect, onselectgroup }: Props = $props();

	const EVERYTHING = 'everything';

	const GROUPS = 'groups';

	const categories: {
		id: FilterCategory | typeof EVERYTHING | typeof GROUPS;
		label: string;
		icon: Component<{ size?: number }>;
	}[] = [
		{ id: EVERYTHING, label: 'Everything', icon: SquaresFourIcon },
		{ id: 'geographical', label: 'Geographical', icon: MapPinIcon },
		{ id: 'survey', label: 'Survey', icon: ClipboardTextIcon },
		{ id: 'canvassing', label: 'Canvassing', icon: DoorOpenIcon },
		{ id: 'meta', label: 'Meta', icon: TagIcon },
		{ id: GROUPS, label: 'Groups', icon: TreeStructureIcon }
	];

	const visibleCategories = $derived(
		onselectgroup ? categories : categories.filter((c) => c.id !== GROUPS)
	);

	let selected = $state<FilterCategory | typeof EVERYTHING | typeof GROUPS>(EVERYTHING);

	const showGroupOption = $derived(
		!!onselectgroup && (selected === EVERYTHING || selected === GROUPS)
	);

	// Sorted by category, then name. Under Everything the list is split into one group per category.
	const groups = $derived(
		FILTER_CATEGORIES.map((id) => ({
			id,
			label: categories.find((c) => c.id === id)?.label ?? id,
			filters: sortFilters(filters).filter((f) => f.category === id)
		})).filter(
			(group) => group.filters.length > 0 && (selected === EVERYTHING || selected === group.id)
		)
	);
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<!-- preventOverflowTextSelection off: bits-ui would otherwise set user-select: text on the dialog while the mouse is down, overriding select-none. -->
		<Dialog.Content
			preventOverflowTextSelection={false}
			class="fixed left-1/2 top-1/2 z-50 flex h-[28rem] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-3xl max-sm:h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface shadow-lg select-none [&_input]:select-text [&_textarea]:select-text"
		>
			<div
				class="flex items-center justify-between border-b border-outline px-4 py-3 sm:px-6 sm:py-4"
			>
				<Dialog.Title class="text-lg font-semibold text-on-surface">Add a Filter</Dialog.Title>
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="sm" iconOnly aria-label="Close">
							<XIcon />
						</Button>
					{/snippet}
				</Dialog.Close>
			</div>

			<!-- On a phone the categories become a strip above the list instead of a sidebar. -->
			<div class="flex min-h-0 flex-1 max-sm:flex-col">
				<nav
					aria-label="Filter categories"
					class="w-48 shrink-0 border-r border-outline p-2 max-sm:w-full max-sm:overflow-x-auto max-sm:border-r-0 max-sm:border-b"
				>
					<ul class="flex flex-col gap-1 max-sm:flex-row">
						{#each visibleCategories as category (category.id)}
							<li class="max-sm:shrink-0">
								<SidebarItem
									item={{ label: category.label, icon: category.icon }}
									active={selected === category.id}
									onclick={() => (selected = category.id)}
								/>
							</li>
						{/each}
					</ul>
				</nav>

				<div class="min-w-0 flex-1 overflow-y-auto p-2">
					{#if groups.length === 0 && !showGroupOption}
						<p class="p-4 text-sm text-on-surface-subtle">No filters in this category yet.</p>
					{:else}
						{#each groups as group (group.id)}
							<section class="mb-2">
								{#if selected === EVERYTHING}
									<h3 class="px-3 py-1 text-sm font-semibold text-on-surface">{group.label}</h3>
								{/if}
								<ul class="flex flex-col gap-1">
									{#each group.filters as filter (filter.id)}
										<li>
											<Button
												variant="ghost"
												class="h-auto! w-full flex-col items-start! justify-start! gap-0! py-2! text-left!"
												onclick={() => onselect?.(filter)}
											>
												<span class="text-sm font-medium text-on-surface">{filter.name}</span>
												<span class="text-sm font-normal text-on-surface-subtle">
													{filter.description}
												</span>
											</Button>
										</li>
									{/each}
								</ul>
							</section>
						{/each}
					{/if}

					{#if showGroupOption}
						<section class="mb-2">
							{#if selected === EVERYTHING}
								<h3 class="px-3 py-1 text-sm font-semibold text-on-surface">Groups</h3>
							{/if}
							<Button
								variant="ghost"
								class="h-auto! w-full flex-col items-start! justify-start! gap-0! py-2! text-left!"
								onclick={() => onselectgroup?.()}
							>
								<span class="text-sm font-medium text-on-surface">Filter Group</span>
								<span class="text-sm font-normal text-on-surface-subtle">
									Combine filters with AND or OR, and nest groups inside each other.
								</span>
							</Button>
						</section>
					{/if}
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
