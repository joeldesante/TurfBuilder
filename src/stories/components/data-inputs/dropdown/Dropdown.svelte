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

	interface Props {
		items: Item[];
		value?: string;
		/** Shown on the trigger while nothing is selected. */
		placeholder?: string;
		disabled?: boolean;
		onValueChange?: (value: string) => void;
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
		heading,
		class: className = '',
		...restProps
	}: Props = $props();

	const selectedLabel = $derived(items.find((item) => item.value === value)?.label);
</script>

<Select.Root type="single" bind:value {items} {disabled} {onValueChange}>
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
			class="z-50 min-w-(--bits-select-anchor-width) select-none rounded-lg border border-outline-subtle bg-surface p-1 shadow-md outline-none"
		>
			<Select.Viewport>
				{#if heading}
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
	{#each items as item, i (item.value)}
		{#if item.group && item.group !== items[i - 1]?.group}
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
