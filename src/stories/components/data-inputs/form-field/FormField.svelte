<script lang="ts">
	import type { Snippet } from 'svelte'
	import { setContext } from 'svelte'
	import { WarningIcon } from 'phosphor-svelte';

	interface Props {
		label: string
		labelVisibility?: 'visible' | 'sr-only'
		id?: string
		requirement?: 'required' | 'optional' | 'none'
		helperText?: string
		errors?: string[]
		dirty?: boolean
		disabled?: boolean
		children: Snippet
		class?: string
		[key: string]: unknown
	}

	let {
		label,
		labelVisibility = 'visible',
		id,
		requirement = 'none',
		helperText,
		errors = [],
		dirty = false,
		disabled = false,
		children,
		class: className = '',
		...restProps
	}: Props = $props()

	let fieldId = $derived(id ?? `field-${crypto.randomUUID().slice(0, 8)}`)
	let invalid = $derived(dirty && errors.length > 0)
	let helperId = $derived(helperText ? `${fieldId}-helper` : undefined)
	let errorId = $derived(invalid ? `${fieldId}-error` : undefined)
	let describedBy = $derived(
		[errorId, helperId].filter(Boolean).join(' ') || undefined
	)

	setContext('formField', {
		get id() {
			return fieldId
		},
		get invalid() {
			return invalid
		},
		get disabled() {
			return disabled
		},
		get describedBy() {
			return describedBy
		}
	})

	let computedClass = $derived(['flex flex-col gap-1.5', className].filter(Boolean).join(' '))
</script>

<div class={computedClass} {...restProps}>
	<label
		for={fieldId}
		class={[
			'text-sm font-medium text-on-surface',
			labelVisibility === 'sr-only' && 'sr-only'
		]
			.filter(Boolean)
			.join(' ')}
	>
		{label}
		{#if requirement === 'required'}
			<span class="text-error text-xs font-normal">*</span>
		{:else if requirement === 'optional'}
			<span class="text-on-surface-subtle text-xs font-normal ml-1">Optional</span>
		{/if}
	</label>

	{@render children()}

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
</div>
