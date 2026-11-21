<script lang="ts">
	import { fade } from 'svelte/transition';
	import Loading from '$components/feedback/loading/Loading.svelte';

	interface Props {
		/** Whether the loader covers the screen. It fades in when it turns on and out when it turns off. */
		visible: boolean;
		/**
		 * The cover appears at once instead of fading in; it still fades out. For a page that came
		 * from a full load, where a see-through cover would show the page filling in underneath.
		 */
		cutIn?: boolean;
		width?: number | string;
		/**
		 * How long the cover is up before the logo fades in on top of it. Until then it is only a
		 * plain fade, so a quick load is a soft dip instead of a flash of logo. 0 shows the logo
		 * straight away.
		 */
		logoDelayMs?: number;
		/**
		 * Once the logo has started to appear, the least time it stays on screen. If `visible` turns
		 * off sooner, the cover waits out the rest before it fades, so the logo never just blinks.
		 * Does not apply when the logo never appeared. 0 turns it off.
		 */
		logoMinMs?: number;
		/**
		 * After the cover has been up this long, a short message fades in under the logo saying the
		 * server is slow. 0 means never.
		 */
		slowMessageDelayMs?: number;
		/** Shown under the logo. A line break (\n) starts a new line. */
		slowMessage?: string;
	}

	const {
		visible,
		cutIn = false,
		width = 'clamp(120px, 45vw, 180px)',
		logoDelayMs = 0,
		logoMinMs = 0,
		slowMessageDelayMs = 0,
		slowMessage = 'This is taking a little longer than usual.\nThanks for your patience.'
	}: Props = $props();

	const FADE_MS = 200;
	const LOGO_FADE_MS = 400;
	const SLOW_MESSAGE_FADE_MS = 1500;

	let logoDelayElapsed = $state(false);
	const showLogo = $derived(logoDelayMs <= 0 || logoDelayElapsed);

	// When the logo started to appear for this showing. Not state: it is only read when the cover
	// is asked to go away.
	let logoShownAt: number | null = null;

	// Start the wait each time the cover comes up. When it goes away the logo is left as it was,
	// so a logo that is already showing fades out with the cover instead of vanishing first.
	$effect(() => {
		if (!visible) return;
		logoDelayElapsed = false;
		logoShownAt = null;
		if (logoDelayMs <= 0) {
			logoShownAt = performance.now();
			return;
		}
		const timer = setTimeout(() => {
			logoDelayElapsed = true;
			logoShownAt = performance.now();
		}, logoDelayMs);
		return () => clearTimeout(timer);
	});

	// Counted from when the cover came up. Like the logo, left as it is when the cover goes away.
	let slowMessageElapsed = $state(false);

	$effect(() => {
		if (!visible) return;
		slowMessageElapsed = false;
		if (slowMessageDelayMs <= 0) return;
		const timer = setTimeout(() => (slowMessageElapsed = true), slowMessageDelayMs);
		return () => clearTimeout(timer);
	});

	// Kept up past `visible` when the logo has not yet had its minimum time on screen.
	let holding = $state(false);
	const covered = $derived(visible || holding);

	$effect(() => {
		if (visible) {
			holding = false;
			return;
		}
		if (logoShownAt === null || logoMinMs <= 0) return;
		const remaining = logoMinMs - (performance.now() - logoShownAt);
		if (remaining <= 0) return;
		holding = true;
		const timer = setTimeout(() => (holding = false), remaining);
		return () => clearTimeout(timer);
	});
</script>

{#if covered}
	<div
		class="page-loader fixed inset-0 z-50 flex items-center justify-center p-6 bg-surface"
		class:page-loader-cut={cutIn}
		out:fade={{ duration: FADE_MS }}
	>
		{#if showLogo}
			<div class="relative" in:fade={{ duration: LOGO_FADE_MS }}>
				<Loading {width} />
				<!-- Out of the flow so the logo does not move when the message arrives. The region is
				     always there, empty, so screen readers announce the text when it fills in. -->
				<p
					aria-live="polite"
					class="absolute left-1/2 top-full mt-6 w-max max-w-[80vw] -translate-x-1/2 text-center text-sm whitespace-pre-line text-on-surface-subtle select-none"
				>
					{#if slowMessageElapsed}
						<span in:fade={{ duration: SLOW_MESSAGE_FADE_MS }}>{slowMessage}</span>
					{/if}
				</p>
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Svelte transitions skip the first render, so the fade-in is plain CSS. */
	.page-loader {
		animation: page-loader-in 200ms ease-out;
	}

	.page-loader-cut {
		animation: none;
	}

	@keyframes page-loader-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
