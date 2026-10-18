import registry from '../registries/filters.json';
import type { FilterCategory, FilterRegistryEntry } from '../types/filter-registry';
import type { ContactMadeValue, FilterEntity } from '../types/filters';

/** Categories in display order. */
export const FILTER_CATEGORIES: FilterCategory[] = ['geographical', 'survey', 'canvassing', 'meta'];

const entries = registry as FilterRegistryEntry[];

/** Orders filters by category, then name, without changing the input array. */
export function sortFilters(filters: FilterRegistryEntry[]): FilterRegistryEntry[] {
	return [...filters].sort(
		(a, b) =>
			FILTER_CATEGORIES.indexOf(a.category) - FILTER_CATEGORIES.indexOf(b.category) ||
			a.name.localeCompare(b.name)
	);
}

/**
 * Returns registry filters. With a category, only that category's filters;
 * without one, every filter ordered by category and then name.
 */
export function getFilters(category?: FilterCategory): FilterRegistryEntry[] {
	if (category) return entries.filter((entry) => entry.category === category);
	return sortFilters(entries);
}

/** The filters that can select a kind of record, ordered by category and then name. */
export function filtersFor(entity: FilterEntity): FilterRegistryEntry[] {
	return sortFilters(entries.filter((entry) => entry.entities.includes(entity)));
}

export function getFilter(id: string): FilterRegistryEntry | undefined {
	return entries.find((entry) => entry.id === id);
}

/** A contact made filter that is valid as it stands: contact made, on any attempt, anywhere, at any time. */
export function defaultContactMade(): ContactMadeValue {
	return {
		contacted: true,
		position: 'any',
		n: null,
		bucketId: null,
		listId: null,
		from: null,
		to: null
	};
}

/**
 * The value a filter starts with when it is added. Most start empty, which the
 * validator rejects until the user fills them in; those with a sensible
 * default start complete.
 */
export function defaultFilterValue(entry: FilterRegistryEntry): unknown {
	if (entry.valueType === 'boolean') return true;
	if (entry.valueType === 'contact_made') return defaultContactMade();
	return '';
}
