import { describe, it, expect } from 'vitest';
import {
	describeFilter,
	formatDate,
	sentenceText,
	sentenceTokens
} from './filter-sentence';
import { defaultContactMade, getFilter, getFilters } from './filter-registry';
import type { Filter } from '../types/filters';

const ID = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';

function say(item: string, filter: Partial<Filter>, options = {}) {
	const entry = getFilter(item)!;
	const full: Filter = { item, operation: entry.operations[0], value: '', ...filter };
	return describeFilter(entry, full, options);
}

const badges = (parts: ReturnType<typeof say>) => parts.filter((p) => p.badge).map((p) => p.text);

describe('every registry filter', () => {
	it('has a sentence that only uses tokens its value type provides', () => {
		for (const entry of getFilters()) {
			const allowed = sentenceTokens(entry);
			const used = [...entry.sentence.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
			expect(used.filter((t) => !allowed.includes(t)), entry.id).toEqual([]);
		}
	});

	it('reads as a sentence with nothing left over, even when it has no value yet', () => {
		for (const entry of getFilters()) {
			const text = sentenceText(describeFilter(entry, { item: entry.id, operation: entry.operations[0], value: '' }));
			expect(text, entry.id).not.toMatch(/[{}]/);
			expect(text.startsWith('Records'), entry.id).toBe(true);
		}
	});

	it('starts a new clause after the kind of record', () => {
		for (const entry of getFilters()) {
			const parts = describeFilter(entry, { item: entry.id, operation: entry.operations[0], value: '' });
			expect(parts[0], entry.id).toMatchObject({ text: 'Records', badge: true });
			expect(parts[1], entry.id).toMatchObject({ break: true, text: ' ' });
		}
	});

	it('marks the unset settings so they stand out', () => {
		expect(say('city', { value: '' }).some((p) => p.incomplete)).toBe(true);
		expect(say('city', { value: 'Austin' }).some((p) => p.incomplete)).toBe(false);
	});
});

describe('the entity', () => {
	it('names the kind of record', () => {
		expect(sentenceText(say('city', { value: 'Austin' }, { entity: 'locations' }))).toContain('Locations');
		expect(sentenceText(say('first_name', { value: 'Al' }, { entity: 'people' }))).toContain('People');
	});

	it('is a badge', () => {
		expect(badges(say('city', { value: 'Austin' }, { entity: 'people' }))[0]).toBe('People');
	});
});

describe('text filters', () => {
	it('reads the operation and value', () => {
		const parts = say('city', { operation: 'contains', value: 'phil' }, { entity: 'locations' });

		expect(sentenceText(parts)).toBe('Locations whose city contains phil');
		expect(badges(parts)).toEqual(['Locations', 'contains', 'phil']);
	});

	it('says when case must match', () => {
		expect(sentenceText(say('city', { value: 'Austin', caseSensitive: true }))).toContain('Austin (match case)');
	});

	it('uses the wording of the operation', () => {
		expect(sentenceText(say('zip_code', { operation: 'starts_with', value: '191' }))).toContain('ZIP code starts with 191');
		expect(sentenceText(say('state', { operation: 'not_equals', value: 'TX' }))).toContain('state is not TX');
	});
});

describe('number and date filters', () => {
	it('adds the unit to a number', () => {
		expect(sentenceText(say('age', { operation: 'greater_than', value: 65 }))).toContain('age is greater than 65 years');
	});

	it('uses wording for dates that reads naturally', () => {
		expect(sentenceText(say('last_canvassed', { operation: 'less_than', value: '2026-01-05' }))).toBe(
			'Records whose last canvass is before Jan 5, 2026'
		);
		expect(sentenceText(say('date_of_birth', { operation: 'greater_than_or_equal', value: '1990-12-31' }))).toContain(
			'is on or after Dec 31, 1990'
		);
	});

	it('does not shift a date with the time zone', () => {
		expect(formatDate('2026-03-01')).toBe('Mar 1, 2026');
	});

	it('passes an unparseable date through', () => {
		expect(formatDate('nope')).toBe('nope');
	});
});

describe('boolean filters', () => {
	it('reads as having or not having the thing', () => {
		expect(sentenceText(say('has_email', { value: true }, { entity: 'people' }))).toBe(
			'People who have an email address'
		);
		expect(sentenceText(say('has_phone', { value: false }, { entity: 'people' }))).toBe(
			'People who do not have a phone number'
		);
	});
});

describe('radius filters', () => {
	const area = { latitude: 39.95, longitude: -75.16, radius: 2 };

	it('reads as within or outside of a distance of a point', () => {
		expect(sentenceText(say('radius_from_point', { operation: 'within', value: area }, { entity: 'people' }))).toBe(
			'People who reside within 2 miles of 39.9500, -75.1600'
		);
		expect(sentenceText(say('radius_from_point', { operation: 'not_within', value: area }))).toContain('outside of 2 miles');
	});

	it('uses the singular for one mile', () => {
		expect(sentenceText(say('radius_from_point', { value: { ...area, radius: 1 } }))).toContain('1 mile of');
	});

	it('marks the point as viewable on a map', () => {
		const point = say('radius_from_point', { value: area }).find((p) => p.view);

		expect(point).toMatchObject({ view: 'radius', badge: true, text: '39.9500, -75.1600' });
	});

	it('has nothing to view before an area is chosen', () => {
		const parts = say('radius_from_point', { value: '' });

		expect(parts.some((p) => p.view)).toBe(false);
		expect(sentenceText(parts)).toContain('no distance yet of no point chosen');
	});
});

describe('region filters', () => {
	it('reads as inside or outside the drawn region, viewable on a map', () => {
		const polygon = { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] };

		const parts = say('inside_drawn_region', { operation: 'not_within', value: polygon });

		expect(sentenceText(parts)).toBe('Records who reside outside the drawn region');
		expect(parts.find((p) => p.view)).toMatchObject({ view: 'polygon' });
	});
});

describe('survey response filters', () => {
	const value = { bucketId: ID, surveyId: ID, questionId: ID, response: 'Yes' };

	it('names the question and survey when they are known', () => {
		const parts = say('survey_question_response', { value }, {
			names: { question: 'Will you vote for it?', survey: 'Spring canvass' }
		});

		expect(sentenceText(parts)).toBe(
			'Records whose answer to Will you vote for it? in Spring canvass is Yes'
		);
	});

	it('reads generically until the names are known', () => {
		expect(sentenceText(say('survey_question_response', { value }))).toContain('answer to a question in a survey is Yes');
	});

	it('marks the unchosen parts', () => {
		const parts = say('survey_question_response', {
			value: { bucketId: ID, surveyId: '', questionId: '', response: '' }
		});

		expect(parts.filter((p) => p.incomplete).map((p) => p.text)).toEqual([
			'no question chosen',
			'no survey chosen',
			'no response chosen'
		]);
	});
});

describe('contact made filters', () => {
	const contact = (change = {}) => ({ ...defaultContactMade(), ...change });

	it('reads the default as contact made on any attempt', () => {
		expect(sentenceText(say('contact_made', { value: contact() }, { entity: 'locations' }))).toBe(
			'Locations where contact was made on any attempt'
		);
	});

	it('reads the outcome', () => {
		expect(sentenceText(say('contact_made', { value: contact({ contacted: false }) }))).toContain('where no contact was made on');
	});

	it('reads the attempt', () => {
		expect(sentenceText(say('contact_made', { value: contact({ position: 'latest' }) }))).toContain('on the latest attempt');
		expect(sentenceText(say('contact_made', { value: contact({ position: 'nth_from_last', n: 2 }) }))).toContain('the 2nd attempt from the last');
		expect(sentenceText(say('contact_made', { value: contact({ position: 'nth_from_last', n: 3 }) }))).toContain('the 3rd attempt');
		expect(sentenceText(say('contact_made', { value: contact({ position: 'nth_from_last', n: 11 }) }))).toContain('the 11th attempt');
		expect(sentenceText(say('contact_made', { value: contact({ position: 'nth_from_last', n: 22 }) }))).toContain('the 22nd attempt');
	});

	it('reads the bucket and list when given, with their names', () => {
		const parts = say('contact_made', { value: contact({ bucketId: ID, listId: ID }) }, {
			names: { bucket: 'Voters', list: 'Ward 3' }
		});

		expect(sentenceText(parts)).toContain('on any attempt in Voters › Ward 3');
	});

	it('reads a bucket alone, and falls back when the name is unknown', () => {
		expect(sentenceText(say('contact_made', { value: contact({ bucketId: ID }) }))).toContain('in a bucket');
	});

	it('reads a range with both, either, or neither end', () => {
		const both = contact({ from: '2026-01-01', to: '2026-01-31' });

		expect(sentenceText(say('contact_made', { value: both }))).toContain('between Jan 1, 2026 and Jan 31, 2026');
		expect(sentenceText(say('contact_made', { value: contact({ from: '2026-01-01' }) }))).toContain('since Jan 1, 2026');
		expect(sentenceText(say('contact_made', { value: contact({ to: '2026-01-31' }) }))).toContain('up to Jan 31, 2026');
		expect(sentenceText(say('contact_made', { value: contact() }))).not.toMatch(/between|since|up to/);
	});

	it('gives the outcome, the attempt, the scope, and the range a clause each', () => {
		const parts = say('contact_made', {
			value: contact({ bucketId: ID, listId: ID, from: '2026-01-01', to: '2026-01-31' })
		}, { names: { bucket: 'Voters', list: 'Ward 3' } });

		const clauses = sentenceText(parts.map((p) => (p.break ? { text: '|' } : p))).split('|');
		expect(clauses).toEqual([
			'Records',
			'where contact was made',
			'on any attempt',
			'in Voters › Ward 3',
			'between Jan 1, 2026 and Jan 31, 2026'
		]);
	});

	it('highlights every setting', () => {
		const parts = say('contact_made', { value: contact({ position: 'latest', from: '2026-01-01' }) }, { entity: 'locations' });

		expect(badges(parts)).toEqual(['Locations', 'contact was made', 'the latest attempt', 'Jan 1, 2026']);
	});
});
