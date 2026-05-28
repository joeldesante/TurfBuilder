<script lang="ts">
	import XIcon from 'phosphor-svelte/lib/X';

	interface Props {
		tags: string[];
		placeholder?: string;
		disabled?: boolean;
		onchange: (tags: string[]) => void;
	}

	const { tags, placeholder = 'Type and press Enter…', disabled = false, onchange }: Props = $props();

	let inputValue = $state('');
	let inputEl = $state<HTMLInputElement | null>(null);

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
<div
	class="flex flex-wrap gap-1.5 w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-primary cursor-text min-h-10"
	onclick={() => inputEl?.focus()}
>
	{#each tags as tag}
		<span class="inline-flex items-center gap-1 rounded bg-surface-container-high px-2 py-0.5 text-xs font-mono text-on-surface">
			{tag}
			{#if !disabled}
				<button
					type="button"
					class="text-on-surface-subtle hover:text-error transition-colors"
					onclick={(e) => { e.stopPropagation(); remove(tag); }}
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
		{placeholder}
		{disabled}
		onkeydown={onKeydown}
		onblur={add}
		class="flex-1 min-w-32 bg-transparent outline-none text-on-surface placeholder:text-on-surface-subtle disabled:cursor-not-allowed"
	/>
</div>
