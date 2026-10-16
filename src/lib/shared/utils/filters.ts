import type { Filter, FilterGroup, FilterOperation } from '../types/filters';

export function isFilterGroup(entry: Filter | FilterGroup): entry is FilterGroup {
	return 'operator' in entry;
}

/** Natural-language labels for each operation, for display next to a filter. */
export const FILTER_OPERATION_LABELS: Record<FilterOperation, string> = {
	equals: 'is',
	not_equals: 'is not',
	greater_than: 'is greater than',
	less_than: 'is less than',
	greater_than_or_equal: 'is at least',
	less_than_or_equal: 'is at most',
	contains: 'contains',
	starts_with: 'starts with',
	within: 'is within',
	not_within: 'is not within',
	answered: 'was answered',
	not_answered: 'was not answered'
};

/** Operations on a survey question that look only at whether it was answered, not at what the answer was. */
export function isAnsweredOperation(operation: string): boolean {
	return operation === 'answered' || operation === 'not_answered';
}
