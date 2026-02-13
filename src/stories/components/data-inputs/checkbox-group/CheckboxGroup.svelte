<script lang="ts">
	import { Checkbox as CheckboxPrimitive } from 'bits-ui'

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
	<legend class="text-sm font-medium text-on-surface">
		{label}
		{#if requirement === 'required'}
			<span class="text-error text-xs font-normal ml-1">Required</span>
		{:else if requirement === 'optional'}
			<span class="text-on-surface-subtle text-xs font-normal ml-1">Optional</span>
		{/if}
	</legend>

	<CheckboxPrimitive.Group bind:value {disabled}>
		<div class={listClass}>
			{#each items as item (item.value)}
				{@const itemId = `${groupId}-${item.value}`}
				<div class="inline-flex items-center gap-2">
					<CheckboxPrimitive.Root
						id={itemId}
						value={item.value}
						disabled={item.disabled}
						class={[
							'size-5 shrink-0 rounded border inline-flex items-center justify-center',
							'focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-1',
							'disabled:opacity-50 disabled:cursor-not-allowed',
							'data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-on-primary',
							invalid ? 'border-error' : 'border-outline'
						]
							.filter(Boolean)
							.join(' ')}
					>
						{#snippet children({ checked })}
							{#if checked}
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
	</CheckboxPrimitive.Group>

	{#if helperText && !invalid}
		<p id={helperId} class="text-xs text-on-surface-subtle">{helperText}</p>
	{/if}

	{#if invalid}
		<div id={errorId} role="alert" class="text-xs text-error">
			{#each errors as error}
				<p>{error}</p>
			{/each}
		</div>
	{/if}
</fieldset>
