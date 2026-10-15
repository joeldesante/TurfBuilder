import { getContext, setContext } from 'svelte';
import type { FilterSource } from '$lib/client/filter-source';
import type { FilterEntity } from '$lib/shared/types/filters';

export const FILTER_SOURCE_KEY = Symbol('filter-source');
const ENTITY_KEY = Symbol('filter-entity');

/** Lets filter rows deep in a query load bucket, list, and survey choices without every group passing the source down. */
export function provideFilterSource(source: FilterSource) {
	setContext(FILTER_SOURCE_KEY, source);
}

export function useFilterSource(): FilterSource | undefined {
	return getContext<FilterSource | undefined>(FILTER_SOURCE_KEY);
}

/**
 * Lets filter rows say which kind of record they select. Given as a getter so
 * a row follows the editor when its entity type changes.
 */
export function provideFilterEntity(entity: () => FilterEntity | undefined) {
	setContext(ENTITY_KEY, entity);
}

export function useFilterEntity(): () => FilterEntity | undefined {
	return getContext<(() => FilterEntity | undefined) | undefined>(ENTITY_KEY) ?? (() => undefined);
}
