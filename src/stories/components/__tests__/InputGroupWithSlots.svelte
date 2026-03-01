<script lang="ts">
	import InputGroup from '../data-inputs/input-group/InputGroup.svelte';
	import TextInput from '../data-inputs/text-input/TextInput.svelte';

	interface Props {
		disabled?: boolean;
		showLeading?: boolean;
		showTrailing?: boolean;
		leadingText?: string;
		trailingText?: string;
	}

	let {
		disabled = false,
		showLeading = false,
		showTrailing = false,
		leadingText = '@',
		trailingText = '.com'
	}: Props = $props();
</script>

<InputGroup {disabled}>
	{#snippet leading()}
		{#if showLeading}
			<span data-testid="leading-slot">{leadingText}</span>
		{/if}
	{/snippet}
	<TextInput placeholder="Enter value" />
	{#snippet trailing()}
		{#if showTrailing}
			<span data-testid="trailing-slot">{trailingText}</span>
		{/if}
	{/snippet}
</InputGroup>
