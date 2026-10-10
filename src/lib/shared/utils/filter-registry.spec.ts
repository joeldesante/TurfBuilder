import { describe, expect, it } from 'vitest';
import { FILTER_CATEGORIES, getFilter, getFilters } from './filter-registry';

describe('filter registry', () => {
	it('has unique ids', () => {
		const ids = getFilters().map((f) => f.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('gives every filter a known category and at least one operation', () => {
		for (const filter of getFilters()) {
			expect(FILTER_CATEGORIES).toContain(filter.category);
			expect(filter.operations.length).toBeGreaterThan(0);
		}
	});

	it('gives every select filter options', () => {
		for (const filter of getFilters().filter((f) => f.valueType === 'select')) {
			expect(filter.options?.length).toBeGreaterThan(0);
		}
	});

	it('returns only the requested category', () => {
		const survey = getFilters('survey');
		expect(survey.length).toBeGreaterThan(0);
		expect(survey.every((f) => f.category === 'survey')).toBe(true);
	});

	it('orders an unfiltered list by category, then name', () => {
		const all = getFilters();
		const order = all.map((f) => FILTER_CATEGORIES.indexOf(f.category));
		expect(order).toEqual([...order].sort((a, b) => a - b));
		const meta = all.filter((f) => f.category === 'meta').map((f) => f.name);
		expect(meta).toEqual([...meta].sort((a, b) => a.localeCompare(b)));
	});

	it('looks a filter up by id', () => {
		expect(getFilter('age')?.name).toBe('Age');
		expect(getFilter('nope')).toBeUndefined();
	});
});
