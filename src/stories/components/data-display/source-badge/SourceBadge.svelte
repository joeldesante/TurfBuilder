<script lang="ts">
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOut';
	import DatabaseIcon from 'phosphor-svelte/lib/Database';
	import { PROVIDER_NAMES, type CatalogueProvider } from '$lib/shared/registries/layer-catalogue';

	/**
	 * A small tag saying where a map layer comes from: the service that listed it, and the
	 * publisher when given. With `href` it is a link to the dataset's own page, opened in a
	 * new tab, so the data can be checked at its source.
	 */
	interface Props {
		provider: CatalogueProvider;
		/** The agency, city or organization that publishes it. */
		publisher?: string;
		/** The dataset's page at its source. */
		href?: string | null;
	}

	const { provider, publisher, href = null }: Props = $props();

	const classes =
		'inline-flex max-w-full items-center gap-1 rounded-full border border-outline-subtle bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant';
</script>

{#if href}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- an external address, not a route of this app -->
	<a
		{href}
		target="_blank"
		rel="noopener noreferrer"
		class="{classes} relative no-underline outline-none hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary"
		title="Open this dataset at its source"
	>
		<DatabaseIcon class="size-3.5 shrink-0" />
		<span class="truncate">{PROVIDER_NAMES[provider]}{publisher ? `: ${publisher}` : ''}</span>
		<ArrowSquareOutIcon class="size-3.5 shrink-0" aria-hidden="true" />
		<span class="sr-only">(opens in a new tab)</span>
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<span class={classes}>
		<DatabaseIcon class="size-3.5 shrink-0" />
		<span class="truncate">{PROVIDER_NAMES[provider]}{publisher ? `: ${publisher}` : ''}</span>
	</span>
{/if}
