<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeft';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRight';
	import type { Snippet } from 'svelte';
	import { pageLinks } from '$lib/shared/utils/pagination';

	interface Props {
		/** 1-based number of the page being shown. */
		page: number;
		/** Rows across all pages. */
		totalCount: number;
		pageSize: number;
		/** What the rows are, plural, for the summary: "Showing 1-100 of 250 locations." */
		noun?: string;
		/** Extra text after the summary, such as a pointer to search. */
		children?: Snippet;
		/** The link for a page. Defaults to `?page=N`; pass one that keeps the page's other query parameters, such as a search. */
		href?: (page: number) => string;
	}

	const { page, totalCount, pageSize, noun = 'records', children, href }: Props = $props();

	const pageHref = (target: number) => (href ? href(target) : `?page=${target}`);

	const totalPages = $derived(Math.max(1, Math.ceil(totalCount / pageSize)));
	const firstShown = $derived(totalCount === 0 ? 0 : (page - 1) * pageSize + 1);
	const lastShown = $derived(Math.min(page * pageSize, totalCount));

	const links = $derived(pageLinks(page, totalPages));
</script>

{#if totalCount > 0}
	<nav
		class="flex flex-col items-center gap-3 px-4 py-3 sm:flex-row sm:justify-between"
		aria-label="Pagination"
	>
		<p class="text-xs text-on-surface-subtle">
			{`Showing ${firstShown.toLocaleString()}–${lastShown.toLocaleString()} of ${totalCount.toLocaleString()} ${noun}.`}
			{@render children?.()}
		</p>

		{#if totalPages > 1}
			<div class="flex items-center gap-1">
				<Button
					variant="ghost"
					size="sm"
					iconOnly
					aria-label="Previous page"
					disabled={page <= 1}
					href={pageHref(page - 1)}
				>
					<CaretLeftIcon />
				</Button>

				{#each links as target, i (i)}
					{#if target === null}
						<span class="px-1 text-xs text-on-surface-subtle" aria-hidden="true">…</span>
					{:else}
						<Button
							variant={target === page ? 'outline' : 'ghost'}
							size="sm"
							href={pageHref(target)}
							aria-label="Page {target}"
							aria-current={target === page ? 'page' : undefined}
						>
							{target}
						</Button>
					{/if}
				{/each}

				<Button
					variant="ghost"
					size="sm"
					iconOnly
					aria-label="Next page"
					disabled={page >= totalPages}
					href={pageHref(page + 1)}
				>
					<CaretRightIcon />
				</Button>
			</div>
		{/if}
	</nav>
{/if}
