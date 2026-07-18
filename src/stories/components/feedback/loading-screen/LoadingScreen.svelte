<script lang="ts">
	import { fade } from 'svelte/transition';
	import Spinner from '$components/feedback/spinner/Spinner.svelte';
	import Logo from '$components/layout/fragments/logo/Logo.svelte';

	interface Props {
		logoWidth?: number;
		/** Milliseconds before the screen appears, so fast loads never flash it. */
		delay?: number;
		fadeInDuration?: number;
		fadeOutDuration?: number;
		statusText?: string;
	}

	const {
		logoWidth = 150,
		delay = 300,
		fadeInDuration = 150,
		fadeOutDuration = 400,
		statusText = undefined
	}: Props = $props();

	let visible = $state(false);
	$effect(() => {
		if (visible) return;
		if (delay <= 0) {
			visible = true;
			return;
		}
		const timeout = setTimeout(() => (visible = true), delay);
		return () => clearTimeout(timeout);
	});
</script>

{#if visible}
	<div
		class="absolute inset-0 z-10 bg-surface flex justify-center items-center flex-col gap-6"
		in:fade={{ duration: fadeInDuration }}
		out:fade={{ duration: fadeOutDuration }}
		role="status"
		aria-label="Loading"
	>
		<Logo width={logoWidth} />
		<div class="flex flex-row">
			<Spinner />
			{#if statusText}
				<span class="pl-2 text-sm text-color-secondary">{statusText}</span>
			{/if}
		</div>
	</div>
{/if}
