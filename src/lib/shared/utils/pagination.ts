/** Rows per page for every paginated page and `/api/v1` collection. */
export const PAGE_SIZE = 100;

/** One page of a collection. The `/api/v1` paginated endpoints return this shape. */
export interface Page<T> {
	items: T[];
	/** Every row the collection holds, not just this page. */
	totalCount: number;
	/** 1-based, clamped to the pages that exist. */
	page: number;
	pageSize: number;
}

/** The `?page=` parameter as a number; NaN or 0 when absent, which `clampPage` turns into 1. */
export function requestedPage(url: URL): number {
	return Number(url.searchParams.get('page'));
}

/**
 * Clamps a requested page to the pages that exist rather than rejecting it: a
 * stale `?page=` from a bookmark, or a deletion that shortened the collection,
 * should land on real rows, not an error.
 */
export function clampPage(requested: number, totalCount: number, pageSize = PAGE_SIZE): number {
	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
	return Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), totalPages) : 1;
}

/** The OFFSET for a page. */
export function pageOffset(page: number, pageSize = PAGE_SIZE): number {
	return (page - 1) * pageSize;
}

/**
 * Page numbers to offer, with nulls standing in for gaps. Always includes the
 * first and last page so the ends of a long list stay one click away.
 */
export function pageLinks(page: number, totalPages: number): (number | null)[] {
	if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

	const window = [page - 1, page, page + 1].filter((p) => p > 1 && p < totalPages);
	const shown = [1, ...window, totalPages];

	const out: (number | null)[] = [];
	for (const [i, p] of shown.entries()) {
		if (i > 0 && p - shown[i - 1] > 1) out.push(null);
		out.push(p);
	}
	return out;
}
