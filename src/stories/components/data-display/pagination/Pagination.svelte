<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeft';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRight';

	interface Props {
		/** 1-based number of the page being shown. */
		page: number;
		/** Rows across all pages. */
		totalCount: number;
		pageSize: number;
		/** What the rows are, plural, for the summary: "Showing 1-100 of 250 locations." */
		noun?: string;
	}

	const { page, totalCount, pageSize, noun = 'records' }: Props = $props();

	const totalPages = $derived(Math.max(1, Math.ceil(totalCount / pageSize)));
	const firstShown = $derived(totalCount === 0 ? 0 : (page - 1) * pageSize + 1);
	const lastShown = $derived(Math.min(page * pageSize, totalCount));

	/**
	 * Page numbers to offer, with nulls standing in for gaps. Always includes the
	 * first and last page so the ends of a long list stay one click away.
	 */
	const pageLinks = $derived.by<(number | null)[]>(() => {
		if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

		const window = [page - 1, page, page + 1].filter((p) => p > 1 && p < totalPages);
		const shown = [1, ...window, totalPages];

		const out: (number | null)[] = [];
		for (const [i, p] of shown.entries()) {
			if (i > 0 && p - shown[i - 1] > 1) out.push(null);
			out.push(p);
		}
		return out;
	});
</script>

{#if totalCount > 0}
	<nav
		class="flex flex-col items-center gap-3 px-4 py-3 sm:flex-row sm:justify-between"
		aria-label="Pagination"
	>
		<p class="text-xs text-on-surface-subtle">
			Showing {firstShown.toLocaleString()}–{lastShown.toLocaleString()} of {totalCount.toLocaleString()}
			{noun}.
		</p>

		{#if totalPages > 1}
			<div class="flex items-center gap-1">
				<Button
					variant="ghost"
					size="sm"
					iconOnly
					aria-label="Previous page"
					disabled={page <= 1}
					href="?page={page - 1}"
				>
					<CaretLeftIcon />
				</Button>

				{#each pageLinks as target, i (i)}
					{#if target === null}
						<span class="px-1 text-xs text-on-surface-subtle" aria-hidden="true">…</span>
					{:else}
						<Button
							variant={target === page ? 'outline' : 'ghost'}
							size="sm"
							href="?page={target}"
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
					href="?page={page + 1}"
				>
					<CaretRightIcon />
				</Button>
			</div>
		{/if}
	</nav>
{/if}
