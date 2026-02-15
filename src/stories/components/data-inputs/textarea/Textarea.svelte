<script lang="ts">
	import { getContext } from 'svelte'

	interface Props {
		value?: string
		placeholder?: string
		rows?: number
		id?: string
		disabled?: boolean
		readonly?: boolean
		class?: string
		[key: string]: unknown
	}

	let {
		value = $bindable(''),
		placeholder,
		rows,
		id,
		disabled = false,
		readonly = false,
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

	let inputId = $derived(id ?? ctx?.id)
	let isInvalid = $derived(ctx?.invalid ?? false)
	let isDisabled = $derived(disabled || (ctx?.disabled ?? false))
	let describedBy = $derived(ctx?.describedBy)

	let computedClass = $derived(
		[
			'w-full text-base text-on-surface bg-surface placeholder:text-on-surface-subtle',
			'px-3 py-2 rounded-md border',
			'focus:outline-2 focus:outline-primary focus:-outline-offset-1',
			'disabled:opacity-50 disabled:cursor-not-allowed',
			isInvalid ? 'border-error' : 'border-outline',
			className
		]
			.filter(Boolean)
			.join(' ')
	)
</script>

<textarea
	id={inputId}
	bind:value
	{placeholder}
	{rows}
	disabled={isDisabled}
	{readonly}
	aria-invalid={isInvalid || undefined}
	aria-describedby={describedBy}
	class={computedClass}
	{...restProps}
></textarea>
