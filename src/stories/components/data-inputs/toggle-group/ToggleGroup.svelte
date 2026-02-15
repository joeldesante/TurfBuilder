<script lang="ts">
	import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui'
	import { WarningIcon } from 'phosphor-svelte';

	interface ToggleItem {
		value: string
		label: string
		disabled?: boolean
	}

	interface SingleProps {
		label: string
		type?: 'single'
		value?: string
		items: ToggleItem[]
		orientation?: 'vertical' | 'horizontal'
		requirement?: 'required' | 'optional' | 'none'
		helperText?: string
		errors?: string[]
		dirty?: boolean
		disabled?: boolean
		loop?: boolean
		rovingFocus?: boolean
		class?: string
		[key: string]: unknown
	}

	interface MultipleProps {
		label: string
		type: 'multiple'
		value?: string[]
		items: ToggleItem[]
		orientation?: 'vertical' | 'horizontal'
		requirement?: 'required' | 'optional' | 'none'
		helperText?: string
		errors?: string[]
		dirty?: boolean
		disabled?: boolean
		loop?: boolean
		rovingFocus?: boolean
		class?: string
		[key: string]: unknown
	}

	type Props = SingleProps | MultipleProps

	let {
		label,
		type = 'single',
		value = $bindable(),
		items,
		orientation = 'horizontal',
		requirement = 'none',
		helperText,
		errors = [],
		dirty = false,
		disabled = false,
		loop = true,
		rovingFocus = true,
		class: className = '',
		...restProps
	}: Props = $props()

	let groupId = `toggle-group-${crypto.randomUUID().slice(0, 8)}`
	let invalid = $derived(dirty && errors.length > 0)
	let helperId = $derived(helperText ? `${groupId}-helper` : undefined)
	let errorId = $derived(invalid ? `${groupId}-error` : undefined)

	let computedClass = $derived(
		['flex flex-col gap-1.5', className].filter(Boolean).join(' ')
	)

	let itemListClass = $derived(
		[
			'flex gap-2',
			orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'
		]
			.filter(Boolean)
			.join(' ')
	)

	function itemClass(invalid: boolean): string {
		return [
			'inline-flex items-center justify-center rounded-lg px-4 h-12 md:h-10',
			'text-base md:text-sm font-medium select-none',
			'border transition-colors',
			'focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-1',
			'disabled:opacity-50 disabled:cursor-not-allowed',
			invalid ? 'border-error' : 'border-outline-subtle',
			'data-[state=on]:bg-primary data-[state=on]:text-on-primary data-[state=on]:border-primary',
			'data-[state=off]:bg-surface data-[state=off]:text-on-surface',
			'hover:not-disabled:cursor-pointer',
			'hover:not-disabled:data-[state=off]:bg-surface-container'
		]
			.filter(Boolean)
			.join(' ')
	}
</script>

<fieldset
	class={computedClass}
	aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
	{disabled}
	{...restProps}
>
	<legend class="text-sm font-medium text-on-surface mb-1.5">
		{label}
		{#if requirement === 'required'}
			<span class="text-error text-xs font-normal">*</span>
		{:else if requirement === 'optional'}
			<span class="text-on-surface-subtle text-xs font-normal ml-1">Optional</span>
		{/if}
	</legend>

	{#if type === 'multiple'}
		<ToggleGroupPrimitive.Root
			type="multiple"
			bind:value={value as string[]}
			{disabled}
			{loop}
			{rovingFocus}
			{orientation}
		>
			<div class={itemListClass}>
				{#each items as item (item.value)}
					<ToggleGroupPrimitive.Item
						value={item.value}
						disabled={item.disabled}
						class={itemClass(invalid)}
					>
						{item.label}
					</ToggleGroupPrimitive.Item>
				{/each}
			</div>
		</ToggleGroupPrimitive.Root>
	{:else}
		<ToggleGroupPrimitive.Root
			type="single"
			bind:value={value as string}
			{disabled}
			{loop}
			{rovingFocus}
			{orientation}
		>
			<div class={itemListClass}>
				{#each items as item (item.value)}
					<ToggleGroupPrimitive.Item
						value={item.value}
						disabled={item.disabled}
						class={itemClass(invalid)}
					>
						{item.label}
					</ToggleGroupPrimitive.Item>
				{/each}
			</div>
		</ToggleGroupPrimitive.Root>
	{/if}

	{#if helperText && !invalid}
		<p id={helperId} class="text-xs text-on-surface-subtle">{helperText}</p>
	{/if}

	{#if invalid}
		<div id={errorId} role="alert" class="text-xs text-error flex items-center gap-1">
			<WarningIcon />
			{#each errors as error}
				<p>{error}</p>
			{/each}
		</div>
	{/if}
</fieldset>
