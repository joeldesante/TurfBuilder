<script lang="ts">
	import Button from '../button/Button.svelte';
	import CopySimpleIcon from 'phosphor-svelte/lib/CopySimpleIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';

	interface Props {
		value: string;
		'aria-label'?: string;
		class?: string;
	}

	let {
		value,
		'aria-label': ariaLabel = 'Copy to clipboard',
		class: className = ''
	}: Props = $props();

	let copied = $state(false);
	let timeout: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		return () => {
			if (timeout) clearTimeout(timeout);
		};
	});

	function copy() {
		navigator.clipboard.writeText(value);
		copied = true;
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(() => {
			copied = false;
			timeout = null;
		}, 2000);
	}
</script>

<Button variant="ghost" size="sm" iconOnly aria-label={ariaLabel} onclick={copy} class={className}>
	{#if copied}
		<CheckIcon />
	{:else}
		<CopySimpleIcon />
	{/if}
</Button>
