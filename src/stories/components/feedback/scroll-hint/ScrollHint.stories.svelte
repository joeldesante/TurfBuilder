<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ScrollHint from './ScrollHint.svelte';

	const { Story } = defineMeta({
		title: 'Components/Feedback/Scroll Hint',
		component: ScrollHint,
		tags: ['autodocs'],
		args: { label: 'Scroll to the form' }
	});
</script>

<script lang="ts">
	let form = $state<HTMLElement>();
</script>

<Story name="Default">
	{#snippet template(args)}
		<div class="flex flex-col gap-6">
			<p class="h-[1600px] text-on-surface-subtle">
				A long block of content. The hint stays at the bottom until the form below is on screen.
			</p>
			<div bind:this={form} class="p-4 border border-outline rounded">The form</div>
		</div>
		<ScrollHint {...args} target={form} />
	{/snippet}
</Story>
