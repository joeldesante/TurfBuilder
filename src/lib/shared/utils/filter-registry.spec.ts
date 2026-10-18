import { describe, expect, it } from 'vitest';
import {
	defaultContactMade,
	defaultFilterValue,
	FILTER_CATEGORIES,
	filtersFor,
	getFilter,
	getFilters
} from './filter-registry';

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
		const selects = getFilters().filter((f) => f.valueType === 'select');
		expect(selects.every((f) => (f.options?.length ?? 0) > 0)).toBe(true);
	});

	it('groups what comes from field attempts under canvassing', () => {
		const ids = getFilters('canvassing').map((f) => f.id);
		expect(ids).toEqual(['contact_made', 'canvassed', 'last_canvassed']);
	});

	it('starts a filter with a value that is complete only when it has a sensible default', () => {
		expect(defaultFilterValue(getFilter('city')!)).toBe('');
		expect(defaultFilterValue(getFilter('has_email')!)).toBe(true);
		expect(defaultFilterValue(getFilter('contact_made')!)).toEqual(defaultContactMade());
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

	it('says which kinds of record every filter can select', () => {
		for (const filter of getFilters()) {
			expect(filter.entities.length, filter.id).toBeGreaterThan(0);
			expect(filter.entities.every((e) => e === 'people' || e === 'locations'), filter.id).toBe(true);
		}
	});

	it('offers each kind of record only the filters that can select it', () => {
		const people = filtersFor('people').map((f) => f.id);
		const locations = filtersFor('locations').map((f) => f.id);

		expect(people).toContain('age');
		expect(people).not.toContain('city');
		expect(locations).toContain('city');
		expect(locations).not.toContain('first_name');
	});

	it('orders the filters for a kind of record by category, then name', () => {
		const filters = filtersFor('locations');
		const order = filters.map((f) => FILTER_CATEGORIES.indexOf(f.category));

		expect(order).toEqual([...order].sort((a, b) => a - b));
	});
});
