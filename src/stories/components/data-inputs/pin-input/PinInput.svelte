<script lang="ts">
	import { getContext } from 'svelte';
	import { PinInput as PinInputPrimitive, REGEXP_ONLY_DIGITS_AND_CHARS } from 'bits-ui';

	interface Props {
		value?: string;
		onValueChange?: (value: string) => void;
		onComplete?: (value: string) => void;
		maxlength?: number;
		inputmode?: 'text' | 'numeric' | 'none' | 'search' | 'email' | 'tel' | 'url' | 'decimal';
		pattern?: string;
		pasteTransformer?: (text: string) => string;
		autofocus?: boolean;
		disabled?: boolean;
		name?: string;
		id?: string;
		class?: string;
		[key: string]: unknown;
	}

	let {
		value = $bindable(''),
		onValueChange,
		onComplete,
		maxlength = 6,
		inputmode = 'text',
		pattern = REGEXP_ONLY_DIGITS_AND_CHARS,
		pasteTransformer,
		autofocus = false,
		disabled = false,
		name,
		id,
		class: className = '',
		...restProps
	}: Props = $props();

	const ctx = getContext<
		| {
				id: string;
				invalid: boolean;
				disabled: boolean;
				describedBy: string | undefined;
		  }
		| undefined
	>('formField');

	let inputId = $derived(id ?? ctx?.id);
	let isInvalid = $derived(ctx?.invalid ?? false);
	let isDisabled = $derived(disabled || (ctx?.disabled ?? false));
	let describedBy = $derived(ctx?.describedBy);

	function autofocusAction(node: HTMLElement) {
		if (autofocus) {
			node.querySelector<HTMLInputElement>('input')?.focus();
		}
	}

	let rootClass = $derived(
		['flex items-center gap-2', isDisabled && 'opacity-50 cursor-not-allowed', className]
			.filter(Boolean)
			.join(' ')
	);

	function cellClass(isActive: boolean): string {
		return [
			'flex items-center justify-center',
			'size-10 md:size-14 rounded-lg border text-lg font-medium text-on-surface bg-surface',
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
			.join(' ');
	}
</script>

<div use:autofocusAction>
	<PinInputPrimitive.Root
		bind:value
		{onValueChange}
		onComplete={onComplete ? () => onComplete(value) : undefined}
		{maxlength}
		{inputmode}
		{pattern}
		{pasteTransformer}
		disabled={isDisabled}
		{name}
		{inputId}
		aria-invalid={isInvalid || undefined}
		aria-describedby={describedBy}
		class={rootClass}
		{...restProps}
	>
		{#snippet children({ cells })}
			{#each cells as cell}
				<PinInputPrimitive.Cell {cell} class={cellClass(cell.isActive)}>
					{#if cell.char}
						{cell.char}
					{:else if cell.hasFakeCaret}
						<div class="animate-caret-blink">
							<div class="h-6 md:h-8 w-px bg-on-surface-subtle"></div>
						</div>
					{/if}
				</PinInputPrimitive.Cell>
			{/each}
		{/snippet}
	</PinInputPrimitive.Root>
</div>
