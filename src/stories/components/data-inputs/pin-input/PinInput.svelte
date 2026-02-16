<script lang="ts">
	import { getContext } from 'svelte'
	import { PinInput as PinInputPrimitive, REGEXP_ONLY_DIGITS } from 'bits-ui'

	interface Props {
		value?: string
		onValueChange?: (value: string) => void
		onComplete?: () => void
		maxlength?: number
		pattern?: string
		pasteTransformer?: (text: string) => string
		disabled?: boolean
		name?: string
		id?: string
		class?: string
		[key: string]: unknown
	}

	let {
		value = $bindable(''),
		onValueChange,
		onComplete,
		maxlength = 6,
		pattern = REGEXP_ONLY_DIGITS,
		pasteTransformer,
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

	let inputId = $derived(id ?? ctx?.id)
	let isInvalid = $derived(ctx?.invalid ?? false)
	let isDisabled = $derived(disabled || (ctx?.disabled ?? false))
	let describedBy = $derived(ctx?.describedBy)

	let rootClass = $derived(
		[
			'flex items-center gap-2',
			isDisabled && 'opacity-50 cursor-not-allowed',
			className
		]
			.filter(Boolean)
			.join(' ')
	)

	function cellClass(isActive: boolean): string {
		return [
			'flex items-center justify-center',
			'size-14 md:size-12 rounded-lg border text-lg font-medium text-on-surface bg-surface',
			'transition-colors duration-150',
			isActive
				? isInvalid
					? 'border-error outline-2 outline-offset-2 outline-error'
					: 'border-outline outline-2 outline-offset-2 outline-primary'
				: isInvalid
					? 'border-error'
					: 'border-outline'
		]
			.filter(Boolean)
			.join(' ')
	}
</script>

<PinInputPrimitive.Root
	bind:value
	{onValueChange}
	{onComplete}
	{maxlength}
	{pattern}
	{pasteTransformer}
	disabled={isDisabled}
	{name}
	inputId={inputId}
	aria-invalid={isInvalid || undefined}
	aria-describedby={describedBy}
	class={rootClass}
	{...restProps}
>
	{#snippet children({ cells })}
		{#each cells as cell}
			<PinInputPrimitive.Cell
				{cell}
				class={cellClass(cell.isActive)}
			>
				{#if cell.char}
					{cell.char}
				{:else if cell.hasFakeCaret}
					<span class="animate-pulse text-on-surface-subtle">|</span>
				{/if}
			</PinInputPrimitive.Cell>
		{/each}
	{/snippet}
</PinInputPrimitive.Root>
