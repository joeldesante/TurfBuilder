<script lang="ts">
	import { Select } from 'bits-ui';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDown';
	import CheckIcon from 'phosphor-svelte/lib/Check';

	interface Item {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		items: Item[];
		value?: string;
		/** Shown on the trigger while nothing is selected. */
		placeholder?: string;
		disabled?: boolean;
		onValueChange?: (value: string) => void;
		class?: string;
		[key: string]: unknown;
	}

	let {
		items,
		value = $bindable(''),
		placeholder = 'Select...',
		disabled = false,
		onValueChange,
		class: className = '',
		...restProps
	}: Props = $props();

	const selectedLabel = $derived(items.find((item) => item.value === value)?.label);
</script>

<Select.Root type="single" bind:value {items} {disabled} {onValueChange}>
	<Select.Trigger
		class={[
			'inline-flex h-12 md:h-10 items-center justify-between gap-2 rounded-sm border border-outline bg-surface px-3 text-base text-on-surface',
			'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
			'disabled:opacity-50 disabled:cursor-not-allowed',
			className
		]
			.filter(Boolean)
			.join(' ')}
		{...restProps}
	>
		<span class={selectedLabel ? '' : 'text-on-surface-subtle'}>{selectedLabel ?? placeholder}</span>
		<CaretDownIcon size={16} class="shrink-0 text-on-surface-subtle" />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			sideOffset={4}
			class="z-50 min-w-(--bits-select-anchor-width) select-none rounded-lg border border-outline-subtle bg-surface p-1 shadow-md outline-none"
		>
			<Select.Viewport>
				{#each items as item (item.value)}
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
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>
