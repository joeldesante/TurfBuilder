<script lang="ts">
	import Tooltip from '$components/feedback/tooltip/Tooltip.svelte';
	import Button from '$components/actions/button/Button.svelte';

	/** A Tooltip whose trigger is a Button itself, for tests. */
	const { onclick }: { onclick?: () => void } = $props();
</script>

<Tooltip text="Archive" side="top" delayDuration={0}>
	{#snippet trigger(props)}
		<Button {...props} variant="ghost" iconOnly aria-label="Archive thing" {onclick}>x</Button>
	{/snippet}
</Tooltip>
