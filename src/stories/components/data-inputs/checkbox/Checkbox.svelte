<script lang="ts">
	import type { Snippet } from 'svelte'
	import { getContext } from 'svelte'
	import { Checkbox as CheckboxPrimitive } from 'bits-ui'

	interface Props {
		checked?: boolean
		indeterminate?: boolean
		onCheckedChange?: (checked: boolean) => void
		disabled?: boolean
		name?: string
		value?: string
		id?: string
		children?: Snippet
		class?: string
		[key: string]: unknown
	}

	let {
		checked = $bindable(false),
		indeterminate = $bindable(false),
		onCheckedChange,
		disabled = false,
		name,
		value,
		id,
		children,
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

	let checkboxId = $derived(id ?? ctx?.id)
	let isInvalid = $derived(ctx?.invalid ?? false)
	let isDisabled = $derived(disabled || (ctx?.disabled ?? false))
	let describedBy = $derived(ctx?.describedBy)

	let boxClass = $derived(
		[
			'size-5 shrink-0 rounded border inline-flex items-center justify-center',
			'focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-1',
			'disabled:opacity-50 disabled:cursor-not-allowed',
			'data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-on-primary',
			'data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-on-primary',
			isInvalid ? 'border-error' : 'border-outline',
			className
		]
			.filter(Boolean)
			.join(' ')
	)
</script>

{#if children}
	<div class="inline-flex items-start gap-2">
		<CheckboxPrimitive.Root
			id={checkboxId}
			bind:checked
			bind:indeterminate
			{onCheckedChange}
			disabled={isDisabled}
			{name}
			{value}
			aria-invalid={isInvalid || undefined}
			aria-describedby={describedBy}
			class={boxClass}
			{...restProps}
		>
			{#snippet children({ checked: isChecked, indeterminate: isIndeterminate })}
				{#if isIndeterminate}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"
					>
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
				{:else if isChecked}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="20 6 9 17 4 12" />
					</svg>
				{/if}
			{/snippet}
		</CheckboxPrimitive.Root>
		<label
			for={checkboxId}
			class={[
				'text-sm text-on-surface select-none',
				isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
			]
				.filter(Boolean)
				.join(' ')}
		>
			{@render children()}
		</label>
	</div>
{:else}
	<CheckboxPrimitive.Root
		id={checkboxId}
		bind:checked
		bind:indeterminate
		{onCheckedChange}
		disabled={isDisabled}
		{name}
		{value}
		aria-invalid={isInvalid || undefined}
		aria-describedby={describedBy}
		class={boxClass}
		{...restProps}
	>
		{#snippet children({ checked: isChecked, indeterminate: isIndeterminate })}
			{#if isIndeterminate}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
					stroke-linecap="round"
				>
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
			{:else if isChecked}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="20 6 9 17 4 12" />
				</svg>
			{/if}
		{/snippet}
	</CheckboxPrimitive.Root>
{/if}
