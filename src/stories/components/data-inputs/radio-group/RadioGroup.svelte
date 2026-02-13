<script lang="ts">
	import { RadioGroup as RadioGroupPrimitive } from 'bits-ui'
	import { WarningIcon } from 'phosphor-svelte';

	interface RadioItem {
		value: string
		label: string
		disabled?: boolean
	}

	interface Props {
		label: string
		value?: string
		onValueChange?: (value: string) => void
		items: RadioItem[]
		orientation?: 'vertical' | 'horizontal'
		requirement?: 'required' | 'optional' | 'none'
		helperText?: string
		errors?: string[]
		dirty?: boolean
		disabled?: boolean
		required?: boolean
		name?: string
		loop?: boolean
		class?: string
		[key: string]: unknown
	}

	let {
		label,
		value = $bindable(''),
		onValueChange,
		items,
		orientation = 'vertical',
		requirement = 'none',
		helperText,
		errors = [],
		dirty = false,
		disabled = false,
		required = false,
		name,
		loop = false,
		class: className = '',
		...restProps
	}: Props = $props()

	let groupId = `radio-group-${crypto.randomUUID().slice(0, 8)}`
	let invalid = $derived(dirty && errors.length > 0)
	let helperId = $derived(helperText ? `${groupId}-helper` : undefined)
	let errorId = $derived(invalid ? `${groupId}-error` : undefined)

	let computedClass = $derived(
		['flex flex-col gap-1.5', className].filter(Boolean).join(' ')
	)

	let listClass = $derived(
		[
			'flex gap-3',
			orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'
		]
			.filter(Boolean)
			.join(' ')
	)
</script>

<fieldset
	class={computedClass}
	aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
	{disabled}
	{...restProps}
>
	<legend class="text-sm font-medium text-on-surface mb-2">
		{label}
		{#if requirement === 'required'}
			<span class="text-error text-xs font-normal">*</span>
		{:else if requirement === 'optional'}
			<span class="text-on-surface-subtle text-xs font-normal ml-1">Optional</span>
		{/if}
	</legend>

	<RadioGroupPrimitive.Root
		bind:value
		{onValueChange}
		{disabled}
		{required}
		{name}
		{loop}
		{orientation}
	>
		<div class={listClass}>
			{#each items as item (item.value)}
				{@const itemId = `${groupId}-${item.value}`}
				<div class="inline-flex items-center gap-2">
					<RadioGroupPrimitive.Item
						id={itemId}
						value={item.value}
						disabled={item.disabled}
						class={[
							'size-5 shrink-0 rounded-full border inline-flex items-center justify-center',
							'focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-1',
							'disabled:opacity-50 disabled:cursor-not-allowed',
							invalid ? 'border-error' : 'border-outline',
							'data-[state=checked]:border-primary'
						]
							.filter(Boolean)
							.join(' ')}
					>
						{#snippet children({ checked })}
							{#if checked}
								<span class="size-2.5 rounded-full bg-primary"></span>
							{/if}
						{/snippet}
					</RadioGroupPrimitive.Item>
					<label
						for={itemId}
						class={[
							'text-sm text-on-surface select-none',
							item.disabled || disabled
								? 'opacity-50 cursor-not-allowed'
								: 'cursor-pointer'
						]
							.filter(Boolean)
							.join(' ')}
					>
						{item.label}
					</label>
				</div>
			{/each}
		</div>
	</RadioGroupPrimitive.Root>

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
