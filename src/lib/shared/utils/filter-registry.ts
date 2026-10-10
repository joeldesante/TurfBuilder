import registry from '../registries/filters.json';
import type { FilterCategory, FilterRegistryEntry } from '../types/filter-registry';

/** Categories in display order. */
export const FILTER_CATEGORIES: FilterCategory[] = ['geographical', 'survey', 'meta'];

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

export function getFilter(id: string): FilterRegistryEntry | undefined {
	return entries.find((entry) => entry.id === id);
}
