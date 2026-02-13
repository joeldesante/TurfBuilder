<script lang="ts">
	import { Checkbox as CheckboxPrimitive } from 'bits-ui'
	import Checkbox from '../checkbox/Checkbox.svelte'
	import { WarningIcon } from 'phosphor-svelte';

	interface CheckboxItem {
		value: string
		label: string
		disabled?: boolean
	}

	interface Props {
		label: string
		value?: string[]
		items: CheckboxItem[]
		orientation?: 'vertical' | 'horizontal'
		requirement?: 'required' | 'optional' | 'none'
		helperText?: string
		errors?: string[]
		dirty?: boolean
		disabled?: boolean
		class?: string
		[key: string]: unknown
	}

	let {
		label,
		value = $bindable([]),
		items,
		orientation = 'vertical',
		requirement = 'none',
		helperText,
		errors = [],
		dirty = false,
		disabled = false,
		class: className = '',
		...restProps
	}: Props = $props()

	let groupId = `checkbox-group-${crypto.randomUUID().slice(0, 8)}`
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

	<CheckboxPrimitive.Group bind:value {disabled}>
		<div class={listClass}>
			{#each items as item (item.value)}
				<Checkbox
					id={`${groupId}-${item.value}`}
					value={item.value}
					disabled={item.disabled}
					{invalid}
				>
					{item.label}
				</Checkbox>
			{/each}
		</div>
	</CheckboxPrimitive.Group>

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
