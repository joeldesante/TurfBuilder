import { describe, it, expect } from 'vitest';
import { filterGroupSchema, filterSchema, isValidFilterGroup, valueSchemaFor } from './filters';
import { defaultContactMade } from '../utils/filter-registry';
import type { FilterRegistryEntry } from '../types/filter-registry';

const ID = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';

const group = (...filters: unknown[]) => ({ operator: 'AND', filters });
const f = (item: string, operation: string, value: unknown, extra = {}) => ({
	item,
	operation,
	value,
	...extra
});

/** The issue paths a document fails with, as dotted strings. */
function paths(doc: unknown) {
	const result = filterGroupSchema.safeParse(doc);
	return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
}

describe('a complete filter', () => {
	it.each([
		['text', f('city', 'equals', 'Austin')],
		['number', f('age', 'greater_than', 65)],
		['date', f('date_of_birth', 'less_than', '1990-01-01')],
		['boolean', f('has_email', 'equals', true)],
		['contact made', f('contact_made', 'equals', defaultContactMade())],
		['radius', f('radius_from_point', 'within', { latitude: 40.02, longitude: -75.22, radius: 2 })],
		[
			'polygon',
			f('inside_drawn_region', 'within', {
				type: 'Polygon',
				coordinates: [
					[
						[0, 0],
						[0, 1],
						[1, 1],
						[0, 0]
					]
				]
			})
		],
		[
			'survey response',
			f('survey_question_response', 'equals', {
				bucketId: ID,
				surveyId: ID,
				questionId: ID,
				response: 'Yes'
			})
		]
	])('accepts a %s filter', (_name, filter) => {
		expect(filterSchema.safeParse(filter).success).toBe(true);
	});

	it('accepts case sensitivity on a text filter', () => {
		expect(filterSchema.safeParse(f('city', 'equals', 'Austin', { caseSensitive: true })).success).toBe(true);
	});
});

describe('an incomplete or wrong filter', () => {
	it.each([
		['a blank text value', f('city', 'equals', '')],
		['text given a number', f('city', 'equals', 5)],
		['a non-finite number', f('age', 'equals', Infinity)],
		['a number given as text', f('age', 'equals', '65')],
		['a malformed date', f('date_of_birth', 'less_than', '01/02/1990')],
		['a date that does not exist', f('date_of_birth', 'less_than', '2023-02-29')],
		['a timestamp instead of a date', f('date_of_birth', 'less_than', '2024-01-01T00:00:00Z')],
		['a boolean given as text', f('has_email', 'equals', 'true')],
		['a radius with no area chosen', f('radius_from_point', 'within', '')],
		['a radius out of range', f('radius_from_point', 'within', { latitude: 99, longitude: 0, radius: 1 })],
		['a zero radius', f('radius_from_point', 'within', { latitude: 1, longitude: 1, radius: 0 })],
		['an unclosed polygon ring', f('inside_drawn_region', 'within', { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0]]] })],
		['a survey filter with no question', f('survey_question_response', 'equals', { bucketId: ID, surveyId: '', questionId: '', response: '' })],
		['a survey response that is not ids', f('survey_question_response', 'equals', { bucketId: 'x', surveyId: 'y', questionId: 'z', response: 'Yes' })]
	])('rejects %s', (_name, filter) => {
		expect(filterSchema.safeParse(filter).success).toBe(false);
	});

	it('rejects an unknown filter', () => {
		expect(paths(group(f('shoe_size', 'equals', 'x')))).toEqual(['filters.0.item']);
	});

	it('rejects an operation the filter does not offer', () => {
		expect(paths(group(f('city', 'greater_than', 'Austin')))).toEqual(['filters.0.operation']);
	});

	it('rejects case sensitivity on a non-text filter', () => {
		expect(paths(group(f('age', 'equals', 3, { caseSensitive: true })))).toEqual([
			'filters.0.caseSensitive'
		]);
	});

	it('points at the value of an incomplete filter', () => {
		expect(paths(group(f('city', 'equals', '')))).toEqual(['filters.0.value']);
	});
});

describe('select values', () => {
	// No registry filter is a select today, so this uses one made for the test.
	const entry: FilterRegistryEntry = {
		id: 'x',
		name: 'X',
		description: '',
		category: 'meta',
		sentence: 'Select only {entity} whose x {operation} {value}',
		valueType: 'select',
		operations: ['equals'],
		options: [{ value: 'yes', label: 'Yes' }]
	};

	it('accepts a listed option', () => {
		expect(valueSchemaFor(entry).safeParse('yes').success).toBe(true);
	});

	it('rejects an option that is not listed', () => {
		expect(valueSchemaFor(entry).safeParse('maybe').success).toBe(false);
	});
});

describe('a contact made filter', () => {
	const contact = (change: Record<string, unknown>) =>
		f('contact_made', 'equals', { ...defaultContactMade(), ...change });
	const valid = (change: Record<string, unknown>) => filterSchema.safeParse(contact(change)).success;

	it('accepts every position, a scope, and a date range', () => {
		expect(valid({ position: 'latest' })).toBe(true);
		expect(valid({ position: 'nth_from_last', n: 3 })).toBe(true);
		expect(valid({ bucketId: ID, listId: ID, from: '2026-01-01', to: '2026-01-31' })).toBe(true);
		expect(valid({ from: '2026-01-01', to: '2026-01-01' })).toBe(true);
	});

	it('needs a number for "from the last" and nothing else does', () => {
		expect(valid({ position: 'nth_from_last', n: null })).toBe(false);
		expect(valid({ position: 'latest', n: 2 })).toBe(false);
		expect(valid({ position: 'any', n: 2 })).toBe(false);
	});

	it('rejects a count that is not a whole number of at least 2', () => {
		expect(valid({ position: 'nth_from_last', n: 1 })).toBe(false);
		expect(valid({ position: 'nth_from_last', n: 2.5 })).toBe(false);
		expect(valid({ position: 'nth_from_last', n: 51 })).toBe(false);
	});

	it('rejects a range that ends before it starts, and says so', () => {
		const result = filterSchema.safeParse(contact({ from: '2026-02-01', to: '2026-01-01' }));

		expect(result.success).toBe(false);
		expect(!result.success && result.error.issues[0].message).toBe('The end date is before the start date');
	});

	it('rejects ids that are not uuids and dates that do not exist', () => {
		expect(valid({ bucketId: 'nope' })).toBe(false);
		expect(valid({ from: '2026-02-30' })).toBe(false);
	});

	it('rejects a value that is not a contact made object', () => {
		expect(filterSchema.safeParse(f('contact_made', 'equals', '')).success).toBe(false);
		expect(filterSchema.safeParse(f('contact_made', 'equals', true)).success).toBe(false);
	});

	it('only allows "is"', () => {
		expect(filterSchema.safeParse(f('contact_made', 'not_equals', defaultContactMade())).success).toBe(false);
	});
});

describe('a group', () => {
	it('accepts an empty group', () => {
		expect(isValidFilterGroup(group())).toBe(true);
	});

	it('accepts groups nested to any depth', () => {
		const nested = group(
			f('city', 'equals', 'Austin'),
			{ operator: 'OR', filters: [f('age', 'less_than', 30), { operator: 'AND', filters: [f('has_email', 'equals', true)] }] }
		);
		expect(isValidFilterGroup(nested)).toBe(true);
	});

	it('finds an invalid filter inside a nested group', () => {
		const nested = group({ operator: 'OR', filters: [f('age', 'less_than', 'old')] });
		expect(paths(nested)).toEqual(['filters.0.filters.0.value']);
	});

	it('rejects an unknown operator', () => {
		expect(isValidFilterGroup({ operator: 'XOR', filters: [] })).toBe(false);
	});

	it.each([[null], [undefined], ['text'], [[]], [{}], [{ operator: 'AND' }]])(
		'rejects %j as a document',
		(doc) => {
			expect(isValidFilterGroup(doc)).toBe(false);
		}
	);
});
