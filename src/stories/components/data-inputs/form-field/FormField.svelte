<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setContext } from 'svelte';
	import { WarningIcon } from 'phosphor-svelte';

	interface Props {
		label: string;
		labelVisibility?: 'visible' | 'sr-only';
		id?: string;
		requirementIndicator?: 'required' | 'optional' | 'none';
		helperText?: string;
		helperContent?: Snippet;
		errors?: string[];
		dirty?: boolean;
		disabled?: boolean;
		children: Snippet;
		labelAction?: Snippet;
		class?: string;
		[key: string]: unknown;
	}

	let {
		label,
		labelVisibility = 'visible',
		id,
		requirementIndicator = 'none',
		helperText,
		helperContent,
		errors = [],
		dirty = false,
		disabled = false,
		children,
		labelAction,
		class: className = '',
		...restProps
	}: Props = $props();

	let fieldId = $derived(id ?? `field-${Math.random().toString(36).slice(2, 10)}`);
	let invalid = $derived(dirty && errors.length > 0);
	let helperId = $derived(helperText || helperContent ? `${fieldId}-helper` : undefined);
	let errorId = $derived(invalid ? `${fieldId}-error` : undefined);
	let describedBy = $derived([errorId, helperId].filter(Boolean).join(' ') || undefined);

	setContext('formField', {
		get id() {
			return fieldId;
		},
		get invalid() {
			return invalid;
		},
		get disabled() {
			return disabled;
		},
		get describedBy() {
			return describedBy;
		}
	});

	let computedClass = $derived(['flex flex-col gap-1.5', className].filter(Boolean).join(' '));
</script>

<div class={computedClass} {...restProps}>
	<div
		class={['flex items-center justify-between', labelVisibility === 'sr-only' && 'sr-only']
			.filter(Boolean)
			.join(' ')}
	>
		<label for={fieldId} class={['text-sm font-medium', invalid ? 'text-error' : 'text-on-surface'].join(' ')}>
			{label}
			{#if requirementIndicator === 'required'}
				<span class="text-error text-xs font-normal">*</span>
			{:else if requirementIndicator === 'optional'}
				<span class="text-on-surface-subtle text-xs font-normal ml-1">Optional</span>
			{/if}
		</label>
		{#if labelAction}
			{@render labelAction()}
		{/if}
	</div>

	{@render children()}

	{#if !invalid && helperContent}
		<p id={helperId} class="text-xs text-on-surface-subtle">{@render helperContent()}</p>
	{:else if !invalid && helperText}
		<p id={helperId} class="text-xs text-on-surface-subtle">{helperText}</p>
	{/if}

	{#if invalid}
		<p id={errorId} role="alert" class="text-xs text-error">{errors[0]}</p>
	{/if}
</div>
