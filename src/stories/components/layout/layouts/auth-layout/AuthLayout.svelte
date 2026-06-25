<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import Logo from '$components/layout/fragments/logo/Logo.svelte';
	import Separator from '$components/layout/fragments/separator/Separator.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		footer?: Snippet;
		showLogo?: boolean;
		title?: string;
	}

	const { children, footer, showLogo = true, title = '' }: Props = $props();
</script>

<div class="flex justify-center items-center flex-col gap-6 p-6 min-h-svh grad select-none h-full">
	{#if showLogo}
		<div class="flex justify-center mt-8 mb-8">
			<Logo />
		</div>
	{/if}

	{#if !showLogo && title}
		<div class="mt-8 mb-4">
			<h1 class="text-2xl font-bold">{title}</h1>
		</div>
	{/if}

	{@render children()}

	{#if footer}
		<div class="text-center mb-8">
			{@render footer()}
		</div>
	{/if}

	<div class="absolute bottom-4 left-1 flex h-5 items-center gap-1">
		<Button href="/privacy" variant="ghost" size="sm" weight="normal" textSize="small"
			>Privacy Policy</Button
		>
		<Separator orientation="vertical" />
		<Button href="/terms" variant="ghost" size="sm" weight="normal" textSize="small"
			>Terms of Service</Button
		>
	</div>
</div>

<style>
	.grad {
		position: relative;
		isolation: isolate;
	}

	.grad::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -2;
		pointer-events: none;
		background-color: var(--surface);
		background-image: url('/static/map.png');
		background-position: center;
		background-size: cover;
		background-blend-mode: hard-light;
		opacity: 0.04;
	}

	:root[data-theme='dark'] .grad::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background: radial-gradient(
			circle,
			oklch(from var(--primary) l c h / 0.03) 0%,
			oklch(from var(--primary) l c h / 0) 100%
		);
	}
</style>
