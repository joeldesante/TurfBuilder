<script lang="ts">
	import { ArrowDownIcon } from 'phosphor-svelte';

	/**
	 * A round arrow pinned to the bottom of the screen that appears while `target` is off screen
	 * and scrolls to it when clicked.
	 */
	interface Props {
		/** The element to scroll to. Nothing shows until it exists. */
		target?: HTMLElement;
		/** Turn the hint off from outside, for example when the content above it is collapsed. @default true */
		enabled?: boolean;
		/** What screen readers announce. @default 'Scroll down' */
		label?: string;
	}

	let { target, enabled = true, label = 'Scroll down' }: Props = $props();

	let targetVisible = $state(true);
	const show = $derived(enabled && !!target && !targetVisible);

	$effect(() => {
		if (!target) return;
		const observer = new IntersectionObserver(([entry]) => {
			targetVisible = entry.isIntersecting;
		});
		observer.observe(target);
		return () => {
			observer.disconnect();
			targetVisible = true;
		};
	});
</script>

{#if show}
	<button
		type="button"
		class="fixed bottom-6 left-1/2 -translate-x-1/2 size-11 flex items-center justify-center rounded-full bg-primary text-on-primary shadow-lg cursor-pointer animate-bounce motion-reduce:animate-none"
		onclick={() => target?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
	>
		<ArrowDownIcon class="size-5" aria-hidden="true" />
		<span class="sr-only">{label}</span>
	</button>
{/if}
