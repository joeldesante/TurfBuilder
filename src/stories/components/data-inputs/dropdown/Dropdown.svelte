<script lang="ts">
	import { Select } from 'bits-ui';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDown';
	import CheckIcon from 'phosphor-svelte/lib/Check';

	interface Item {
		value: string;
		label: string;
		disabled?: boolean;
		/**
		 * A heading for the options from this one on, shown once above the first of a run of
		 * options that share it. Keep the options of one group together.
		 */
		group?: string;
	}

	/** Lists longer than this get a search box, unless `searchable` says otherwise. */
	const SEARCH_THRESHOLD = 10;

	interface Props {
		items: Item[];
		value?: string;
		/** Shown on the trigger while nothing is selected. */
		placeholder?: string;
		disabled?: boolean;
		onValueChange?: (value: string) => void;
		/**
		 * Whether the open list has a box to filter the options by typing. By default only long
		 * lists (more than 10 options) get one.
		 */
		searchable?: boolean;
		/** A heading shown above the options in the open list. */
		heading?: string;
		/** `sm` is a compact pill for tight spots such as toolbars. @default 'md' */
		size?: 'md' | 'sm';
		class?: string;
		[key: string]: unknown;
	}

	let {
		items,
		value = $bindable(''),
		placeholder = 'Select...',
		disabled = false,
		onValueChange,
		size = 'md',
		searchable,
		heading,
		class: className = '',
		...restProps
	}: Props = $props();

	const selectedLabel = $derived(items.find((item) => item.value === value)?.label);

	const showSearch = $derived(searchable ?? items.length > SEARCH_THRESHOLD);

	let open = $state(false);
	let search = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);

	const shown = $derived.by(() => {
		const words = search.toLowerCase().split(/\s+/).filter(Boolean);
		if (words.length === 0) return items;
		return items.filter((item) => {
			const label = item.label.toLowerCase();
			return words.every((word) => label.includes(word));
		});
	});

	// Each opening starts with an empty search and the cursor in the box.
	$effect(() => {
		if (!open) {
			search = '';
		} else if (showSearch) {
			// The list takes focus as it opens; take it back for the search box.
			const timer = setTimeout(() => searchInput?.focus(), 0);
			return () => clearTimeout(timer);
		}
	});

	/**
	 * The list answers typing by jumping to an option, and space by choosing one. In the search box
	 * those keys are text, so only the keys that move through or leave the list reach it.
	 */
	function searchKeydown(event: KeyboardEvent) {
		if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(event.key)) return;
		event.stopPropagation();
	}
</script>

<Select.Root type="single" bind:value bind:open {items} {disabled} {onValueChange}>
	<Select.Trigger
		class={[
			'inline-flex items-center justify-between border border-outline bg-surface text-on-surface',
			size === 'sm'
				? 'h-8 gap-1 rounded-full px-2.5 text-xs'
				: 'h-12 md:h-10 gap-2 rounded-sm px-3 text-base',
			'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
			'disabled:opacity-50 disabled:cursor-not-allowed',
			className
		]
			.filter(Boolean)
			.join(' ')}
		{...restProps}
	>
		<span class={selectedLabel ? '' : 'text-on-surface-subtle'}>{selectedLabel ?? placeholder}</span
		>
		<CaretDownIcon size={size === 'sm' ? 12 : 16} class="shrink-0 text-on-surface-subtle" />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			sideOffset={4}
			collisionPadding={8}
			class="z-50 max-h-(--bits-select-content-available-height) min-w-(--bits-select-anchor-width) select-none overflow-y-auto rounded-lg border border-outline-subtle bg-surface p-1 shadow-md outline-none"
		>
			{#if showSearch}
				<div class="sticky top-0 z-10 -mx-1 -mt-1 mb-1 rounded-t-lg border-b border-outline-subtle bg-surface p-2">
					<input
						bind:this={searchInput}
						bind:value={search}
						onkeydown={searchKeydown}
						type="search"
						role="searchbox"
						aria-label="Search options"
						placeholder="Search"
						autocomplete="off"
						class="h-9 w-full rounded-md border border-outline bg-surface px-3 text-sm text-on-surface outline-none placeholder:text-on-surface-subtle focus-visible:ring-2 focus-visible:ring-primary"
					/>
				</div>
			{/if}
			<Select.Viewport>
				{#if showSearch && shown.length === 0}
					<p class="px-3 py-4 text-center text-sm text-on-surface-subtle">No options match "{search.trim()}".</p>
				{:else if heading}
					<Select.Group>
						<Select.GroupHeading class="px-3 pt-1.5 pb-1 text-sm font-semibold text-on-surface">
							{heading}
						</Select.GroupHeading>
						{@render options()}
					</Select.Group>
				{:else}
					{@render options()}
				{/if}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>

{#snippet options()}
	{#each shown as item, i (item.value)}
		{#if item.group && item.group !== shown[i - 1]?.group}
			<div
				role="presentation"
				data-group-heading
				class="px-3 pt-2 pb-1 text-xs font-semibold text-on-surface-subtle select-none"
			>
				{item.group}
			</div>
		{/if}
		<Select.Item
			value={item.value}
			label={item.label}
			disabled={item.disabled}
			class="flex h-9 cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-sm text-on-surface outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-container-high"
		>
			{#snippet children({ selected })}
				<span class="whitespace-nowrap">{item.label}</span>
				{#if selected}
					<CheckIcon size={16} class="shrink-0 text-primary" />
				{/if}
			{/snippet}
		</Select.Item>
	{/each}
{/snippet}
