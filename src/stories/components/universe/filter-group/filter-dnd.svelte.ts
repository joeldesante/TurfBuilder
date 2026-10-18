import { getContext, setContext } from 'svelte';
import type { FilterPath } from '$lib/shared/utils/filter-tree';

const KEY = Symbol('filter-dnd');

/** Drag state shared by every group in one query, so a node can be dropped into any of them. */
export class FilterDnd {
	/** Path of the node being dragged, or null when nothing is. */
	dragging = $state<FilterPath | null>(null);

	constructor(private readonly move: (from: FilterPath, to: FilterPath) => void) {}

	drop(to: FilterPath) {
		const from = this.dragging;
		this.dragging = null;
		if (from) this.move(from, to);
	}
}

export function provideFilterDnd(dnd: FilterDnd) {
	setContext(KEY, dnd);
}

export function useFilterDnd(): FilterDnd | undefined {
	return getContext<FilterDnd | undefined>(KEY);
}
