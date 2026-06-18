<script lang="ts">
	import Logo from '$components/layout/logo/Logo.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		title: string;
		lastUpdated?: string;
	}

	const { children, title, lastUpdated }: Props = $props();
</script>

<div class="min-h-svh flex flex-col bg-surface">
	<header class="border-b border-border">
		<div class="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
			<a href="/" aria-label="Home">
				<Logo height={32} />
			</a>
			<nav class="flex gap-4 text-sm text-muted">
				<a href="/terms" class="hover:text-foreground transition-colors">Terms of Service</a>
				<a href="/privacy" class="hover:text-foreground transition-colors">Privacy Policy</a>
			</nav>
		</div>
	</header>

	<main class="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
		<div class="mb-8">
			<h1 class="text-3xl font-bold mb-2">{title}</h1>
			{#if lastUpdated}
				<p class="text-sm text-muted">Last updated: {lastUpdated}</p>
			{/if}
		</div>

		<div class="prose-document">
			{@render children()}
		</div>
	</main>

	<footer class="border-t border-border">
		<div class="max-w-3xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
			<p>&copy; {new Date().getFullYear()} TurfBuilder. All rights reserved.</p>
			<div class="flex gap-4">
				<a href="/terms" class="hover:text-foreground transition-colors">Terms of Service</a>
				<a href="/privacy" class="hover:text-foreground transition-colors">Privacy Policy</a>
			</div>
		</div>
	</footer>
</div>

<style>
	:global(.prose-document h2) {
		font-size: 1.25rem;
		font-weight: 600;
		margin-top: 2rem;
		margin-bottom: 0.75rem;
	}

	:global(.prose-document h3) {
		font-size: 1rem;
		font-weight: 600;
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
	}

	:global(.prose-document p) {
		line-height: 1.75;
		margin-bottom: 1rem;
		color: var(--muted-foreground, var(--foreground));
	}

	:global(.prose-document ul) {
		list-style-type: disc;
		padding-left: 1.5rem;
		margin-bottom: 1rem;
	}

	:global(.prose-document li) {
		line-height: 1.75;
		margin-bottom: 0.25rem;
		color: var(--muted-foreground, var(--foreground));
	}

	:global(.prose-document a) {
		color: var(--primary);
		text-decoration: underline;
	}
</style>
