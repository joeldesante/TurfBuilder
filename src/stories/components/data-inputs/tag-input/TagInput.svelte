<script lang="ts">
	import { getContext } from 'svelte';
	import XIcon from 'phosphor-svelte/lib/X';

	interface Props {
		tags: string[];
		placeholder?: string;
		disabled?: boolean;
		onchange: (tags: string[]) => void;
	}

	const {
		tags,
		placeholder = 'Type and press Enter…',
		disabled = false,
		onchange
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

	let inputId = $derived(ctx?.id);
	let isInvalid = $derived(ctx?.invalid ?? false);
	let isDisabled = $derived(disabled || (ctx?.disabled ?? false));
	let describedBy = $derived(ctx?.describedBy);

	let inputValue = $state('');
	let inputEl = $state<HTMLInputElement | null>(null);

	let containerClass = $derived(
		[
			'flex flex-wrap gap-1.5 w-full rounded-sm border bg-surface px-3 py-2 text-sm cursor-text min-h-10',
			isInvalid
				? 'border-error focus-within:ring-2 focus-within:ring-error'
				: 'border-outline focus-within:ring-2 focus-within:ring-primary'
		].join(' ')
	);

	function add() {
		const val = inputValue.trim();
		if (!val || tags.includes(val)) {
			inputValue = '';
			return;
		}
		onchange([...tags, val]);
		inputValue = '';
	}

	function remove(tag: string) {
		onchange(tags.filter((t) => t !== tag));
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			add();
		} else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
			onchange(tags.slice(0, -1));
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class={containerClass} onclick={() => inputEl?.focus()}>
	{#each tags as tag}
		<span
			class="inline-flex items-center gap-1 rounded-sm bg-surface-container-high px-2 py-0.5 text-xs font-mono text-on-surface"
		>
			{tag}
			{#if !isDisabled}
				<button
					type="button"
					class="text-on-surface-subtle hover:text-error transition-colors"
					onclick={(e) => {
						e.stopPropagation();
						remove(tag);
					}}
					aria-label="Remove {tag}"
				>
					<XIcon size={10} weight="bold" />
				</button>
			{/if}
		</span>
	{/each}
	<input
		bind:this={inputEl}
		bind:value={inputValue}
		id={inputId}
		{placeholder}
		disabled={isDisabled}
		aria-invalid={isInvalid || undefined}
		aria-describedby={describedBy}
		onkeydown={onKeydown}
		onblur={add}
		class={[
			'flex-1 min-w-32 bg-transparent outline-none text-on-surface disabled:cursor-not-allowed',
			isInvalid ? 'placeholder:text-error' : 'placeholder:text-on-surface-subtle'
		].join(' ')}
	/>
</div>
