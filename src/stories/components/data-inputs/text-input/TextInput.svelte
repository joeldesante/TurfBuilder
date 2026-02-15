<script lang="ts">
	import { getContext } from 'svelte'

	type InputType = 'text' | 'email' | 'password' | 'url' | 'tel' | 'search' | 'number'

	// TODO: Make grouped prop apply automatically when inside an InputGroup context, and remove the prop from the public API
	interface Props {
		value?: string
		type?: InputType
		placeholder?: string
		id?: string
		disabled?: boolean
		readonly?: boolean
		grouped?: boolean
		class?: string
		[key: string]: unknown
	}

	let {
		value = $bindable(''),
		type = 'text',
		placeholder,
		id,
		disabled = false,
		readonly = false,
		grouped = false,
		class: className = '',
		...restProps
	}: Props = $props()

	const ctx = getContext<{
		id: string
		invalid: boolean
		disabled: boolean
		describedBy: string | undefined
	} | undefined>('formField')

	let inputId = $derived(id ?? ctx?.id)
	let isInvalid = $derived(ctx?.invalid ?? false)
	let isDisabled = $derived(disabled || (ctx?.disabled ?? false))
	let describedBy = $derived(ctx?.describedBy)

	let computedClass = $derived(
		[
			'w-full text-base text-on-surface bg-surface placeholder:text-on-surface-subtle',
			'h-12 md:h-10 px-3 rounded-lg',
			grouped ? 'focus:outline-none' : 'focus-visible:outline-2 focus-visible:outline-offset-2',
			'disabled:opacity-50 disabled:cursor-not-allowed',
			!grouped && 'border',
			!grouped && isInvalid ? 'border-error focus-visible:outline-error' : !grouped ? 'border-outline' : '',
			className
		]
			.filter(Boolean)
			.join(' ')
	)
</script>

<input
	{type}
	id={inputId}
	bind:value
	{placeholder}
	disabled={isDisabled}
	{readonly}
	aria-invalid={isInvalid || undefined}
	aria-describedby={describedBy}
	class={computedClass}
	{...restProps}
/>
