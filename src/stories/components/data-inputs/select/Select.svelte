<script lang="ts">
	import { getContext } from 'svelte'

	interface SelectItem {
		value: string
		label: string
		disabled?: boolean
	}

	interface SelectGroup {
		heading: string
		items: SelectItem[]
	}

	interface Props {
		value?: string
		items?: SelectItem[]
		groups?: SelectGroup[]
		placeholder?: string
		disabled?: boolean
		name?: string
		id?: string
		class?: string
		[key: string]: unknown
	}

	let {
		value = $bindable(''),
		items,
		groups,
		placeholder,
		disabled = false,
		name,
		id,
		class: className = '',
		...restProps
	}: Props = $props()

	const ctx = getContext<
		| {
				id: string
				invalid: boolean
				disabled: boolean
				describedBy: string | undefined
			}
		| undefined
	>('formField')

	let selectId = $derived(id ?? ctx?.id)
	let isInvalid = $derived(ctx?.invalid ?? false)
	let isDisabled = $derived(disabled || (ctx?.disabled ?? false))
	let describedBy = $derived(ctx?.describedBy)

	let computedClass = $derived(
		[
			'w-full text-base text-on-surface bg-surface',
			'h-12 md:h-10 px-3 rounded-md border appearance-none',
			'focus:outline-2 focus:outline-primary focus:-outline-offset-1',
			'disabled:opacity-50 disabled:cursor-not-allowed',
			isInvalid ? 'border-error' : 'border-outline',
			className
		]
			.filter(Boolean)
			.join(' ')
	)
</script>

<select
	id={selectId}
	bind:value
	{name}
	disabled={isDisabled}
	aria-invalid={isInvalid || undefined}
	aria-describedby={describedBy}
	class={computedClass}
	{...restProps}
>
	{#if placeholder}
		<option value="" disabled selected hidden>{placeholder}</option>
	{/if}

	{#if items}
		{#each items as item}
			<option value={item.value} disabled={item.disabled}>{item.label}</option>
		{/each}
	{/if}

	{#if groups}
		{#each groups as group}
			<optgroup label={group.heading}>
				{#each group.items as item}
					<option value={item.value} disabled={item.disabled}>{item.label}</option>
				{/each}
			</optgroup>
		{/each}
	{/if}
</select>
