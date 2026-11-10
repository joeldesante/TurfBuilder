<script lang="ts">
	/** Progress bars, "Step x of y", and the current step's title, for multi-step forms. */
	interface Props {
		/** The title of each step, in order. */
		steps: string[];
		/** Index of the current step, starting at 0. */
		current: number;
		/**
		 * The heading element. Bind it to move focus to the new step when it changes, so screen
		 * readers announce it.
		 */
		heading?: HTMLHeadingElement;
		class?: string;
	}

	let { steps, current, heading = $bindable(), class: className = '' }: Props = $props();
</script>

<div class={['flex flex-col gap-3', className].filter(Boolean).join(' ')}>
	<ol class="flex gap-2" aria-label="Progress">
		{#each steps as title, index (title)}
			<li
				class={['h-1 flex-1 rounded-full', index <= current ? 'bg-primary' : 'bg-outline'].join(
					' '
				)}
				aria-current={index === current ? 'step' : undefined}
			>
				<span class="sr-only">{title}</span>
			</li>
		{/each}
	</ol>
	<p class="text-sm text-on-surface-subtle">Step {current + 1} of {steps.length}</p>
	<h2 bind:this={heading} tabindex="-1" class="text-xl font-semibold text-on-surface outline-none">
		{steps[current]}
	</h2>
</div>
