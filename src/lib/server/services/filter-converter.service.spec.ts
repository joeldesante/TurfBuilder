import { describe, it, expect } from 'vitest';
import { convertBucketFilter, type BucketFilterInput } from './filter-converter.service';

const off = { enabled: false, matchType: 'ALL' as const, conditions: [] };

function locations(
	matchType: BucketFilterInput['locations']['matchType'],
	conditions: BucketFilterInput['locations']['conditions']
) {
	return convertBucketFilter({ people: off, locations: { enabled: true, matchType, conditions } })
		.locations.query;
}

function people(conditions: BucketFilterInput['people']['conditions']) {
	return convertBucketFilter({
		people: { enabled: true, matchType: 'ALL', conditions },
		locations: off
	}).people.query;
}

describe('convertBucketFilter', () => {
	it('stores the version and leaves disabled kinds without a query', () => {
		expect(convertBucketFilter({ people: off, locations: off })).toEqual({
			v: 1,
			people: { enabled: false, query: null },
			locations: { enabled: false, query: null }
		});
	});

	it('maps location fields and text qualifiers onto v_locations', () => {
		const query = locations('ALL', [
			{ filterId: 'city', qualifierId: 'is', value: 'Philadelphia' },
			{ filterId: 'state', qualifierId: 'is_not', value: 'NJ' },
			{ filterId: 'zip_code', qualifierId: 'starts_with', value: '191' },
			{ filterId: 'city', qualifierId: 'contains', value: 'del' }
		]);

		expect(query?.from).toBe('universe.v_locations vl');
		expect(query?.where).toEqual({
			type: 'group',
			connector: 'AND',
			negate: false,
			children: [
				{ type: 'condition', column: 'vl.city', op: '=', negate: false, value: 'Philadelphia' },
				{ type: 'condition', column: 'vl.state_or_region', op: '!=', negate: false, value: 'NJ' },
				{ type: 'condition', column: 'vl.postal_code', op: 'ILIKE', negate: false, value: '191%' },
				{ type: 'condition', column: 'vl.city', op: 'ILIKE', negate: false, value: '%del%' }
			]
		});
	});

	it('joins with OR for one or more, and stores none as a negated AND, as the old pages did', () => {
		const city = { filterId: 'city', qualifierId: 'is', value: 'Camden' };
		const state = { filterId: 'state', qualifierId: 'is', value: 'NJ' };

		expect(locations('ONE_OR_MORE', [city, state])?.where).toMatchObject({
			connector: 'OR',
			negate: false
		});
		expect(locations('NONE', [city, state])?.where).toMatchObject({
			connector: 'AND',
			negate: true
		});
	});

	it('maps people fields, numbers, dates, and presence checks', () => {
		const query = people([
			{ filterId: 'first_name', qualifierId: 'is', value: 'Ada' },
			{ filterId: 'age', qualifierId: 'gte', value: '18' },
			{ filterId: 'dob', qualifierId: 'before', value: '2000-01-01' },
			{ filterId: 'has_email', qualifierId: 'yes', value: '' }
		]);

		expect(query?.from).toBe('universe.v_people vp');
		expect(query?.where?.children).toEqual([
			{ type: 'condition', column: 'vp.first_name', op: '=', negate: false, value: 'Ada' },
			{
				type: 'condition',
				column: 'EXTRACT(YEAR FROM AGE(CURRENT_DATE, vp.dob))',
				op: '>=',
				negate: false,
				value: 18
			},
			{ type: 'condition', column: 'vp.dob', op: '<', negate: false, value: '2000-01-01' },
			{ type: 'condition', column: 'vp.email', op: 'IS NOT NULL', negate: false }
		]);
	});

	it('skips fields and qualifiers it cannot map, and a group with nothing left has no where', () => {
		const query = people([
			{ filterId: 'shoe_size', qualifierId: 'is', value: '9' },
			{ filterId: 'age', qualifierId: 'eq', value: 'not a number' },
			{ filterId: 'first_name', qualifierId: 'sounds_like', value: 'Ada' },
			{ filterId: 'dob', qualifierId: 'after', value: '' }
		]);

		expect(query).not.toHaveProperty('where');
	});
});
