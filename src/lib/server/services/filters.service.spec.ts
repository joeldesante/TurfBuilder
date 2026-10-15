import { describe, it, expect } from 'vitest';
import { buildFilterQuery, convertLegacyBucketFilter, LegacyFilterError } from './filters.service';
import { convertBucketFilter } from '$lib/server/filter-converter';
import type { BucketFilterInput, MatchType, StoredBucketFilter } from '$lib/server/filter-converter';

const group = (operator: 'AND' | 'OR', ...filters: unknown[]) => ({ operator, filters });
const f = (item: string, operation: string, value: unknown, extra = {}) => ({
	item,
	operation,
	value,
	...extra
});

const LOC = 'SELECT vl.id, vl.source FROM universe.v_locations vl';
const PEOPLE = 'SELECT vp.id, vp.source FROM universe.v_people vp';

const loc = (doc: unknown) => buildFilterQuery('locations', doc);
const people = (doc: unknown) => buildFilterQuery('people', doc);

describe('an empty document', () => {
	it('matches every record', () => {
		expect(loc(group('AND'))).toEqual({ sql: LOC, params: [] });
		expect(people(group('OR'))).toEqual({ sql: PEOPLE, params: [] });
	});
});

describe('text filters', () => {
	it('compares case-insensitively by default', () => {
		expect(loc(group('AND', f('city', 'equals', 'Austin')))).toEqual({
			sql: `${LOC} WHERE (lower(vl.city) = lower($1))`,
			params: ['Austin']
		});
	});

	it('compares exactly when case sensitive', () => {
		expect(loc(group('AND', f('city', 'equals', 'Austin', { caseSensitive: true }))).sql).toBe(
			`${LOC} WHERE (vl.city = $1)`
		);
	});

	it('keeps rows with no value for "is not"', () => {
		expect(loc(group('AND', f('state', 'not_equals', 'TX'))).sql).toContain(
			'lower(vl.state_or_region) IS DISTINCT FROM lower($1)'
		);
	});

	it('wraps contains and starts_with in wildcards and escapes the text', () => {
		expect(loc(group('AND', f('city', 'contains', '50%_off\\')))).toEqual({
			sql: `${LOC} WHERE (vl.city ILIKE $1)`,
			params: ['%50\\%\\_off\\\\%']
		});
		expect(people(group('AND', f('first_name', 'starts_with', 'Al', { caseSensitive: true })))).toEqual({
			sql: `${PEOPLE} WHERE (vp.first_name LIKE $1)`,
			params: ['Al%']
		});
	});

	it('never puts a value in the SQL text', () => {
		const query = loc(group('AND', f('city', 'equals', "'; DROP TABLE x; --")));

		expect(query.sql).not.toContain('DROP');
		expect(query.params).toEqual(["'; DROP TABLE x; --"]);
	});

	it('maps the ZIP code and state columns', () => {
		expect(loc(group('AND', f('zip_code', 'starts_with', '191'))).sql).toContain('vl.postal_code ILIKE $1');
	});
});

describe('person filters', () => {
	it('compares age by the years since birth', () => {
		expect(people(group('AND', f('age', 'greater_than_or_equal', 65)))).toEqual({
			sql: `${PEOPLE} WHERE (EXTRACT(YEAR FROM AGE(CURRENT_DATE, vp.dob)) >= $1)`,
			params: [65]
		});
	});

	it('compares dates of birth as dates', () => {
		expect(people(group('AND', f('date_of_birth', 'less_than', '1990-01-01')))).toEqual({
			sql: `${PEOPLE} WHERE (vp.dob < $1::date)`,
			params: ['1990-01-01']
		});
	});

	it('treats an empty email or phone as missing', () => {
		expect(people(group('AND', f('has_email', 'equals', true))).sql).toContain("NULLIF(vp.email, '') IS NOT NULL");
		expect(people(group('AND', f('has_phone', 'equals', false))).sql).toContain("NULLIF(vp.phone, '') IS NULL");
	});
});

describe('spatial filters', () => {
	const area = { latitude: 40.02, longitude: -75.22, radius: 2 };

	it('turns the radius into meters around the point', () => {
		const query = loc(group('AND', f('radius_from_point', 'within', area)));

		expect(query.sql).toContain('COALESCE(ST_DWithin(vl.coordinates::geography');
		expect(query.params).toEqual([-75.22, 40.02, 2 * 1609.344]);
	});

	it('includes records with no position for "not within"', () => {
		expect(loc(group('AND', f('radius_from_point', 'not_within', area))).sql).toContain(
			'NOT COALESCE(ST_DWithin('
		);
	});

	it('passes a drawn region as GeoJSON', () => {
		const polygon = {
			type: 'Polygon',
			coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]]
		};

		const query = loc(group('AND', f('inside_drawn_region', 'within', polygon)));

		expect(query.sql).toContain('ST_Intersects(vl.coordinates, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))');
		expect(query.params).toEqual([JSON.stringify(polygon)]);
	});
});

describe('canvassing filters', () => {
	const contact = (change: Record<string, unknown> = {}) =>
		f('contact_made', 'equals', {
			contacted: true,
			position: 'any',
			n: null,
			bucketId: null,
			listId: null,
			from: null,
			to: null,
			...change
		});
	const BUCKET = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
	const LIST = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
	const flat = (sql: string) => sql.replace(/\s+/g, ' ');

	it('finds locations with any attempt that made contact', () => {
		const query = loc(group('AND', contact()));

		expect(flat(query.sql)).toContain(
			'EXISTS (SELECT tla.contact_made FROM universe.turf_location_attempt tla' +
				' JOIN universe.turf_location tl ON tl.id = tla.turf_location_id' +
				' LEFT JOIN universe.public_location tpl ON tpl.id = tl.public_location_id' +
				' LEFT JOIN universe.org_location tol ON tol.id = tl.org_location_id' +
				' WHERE COALESCE(tpl.entity_id, tol.entity_id) = vl.entity_id AND tla.contact_made = $1)'
		);
		expect(query.params).toEqual([true]);
	});

	it('can look for attempts where no one was reached', () => {
		expect(loc(group('AND', contact({ contacted: false }))).params).toEqual([false]);
	});

	it('looks only at the newest attempt for "latest"', () => {
		const query = loc(group('AND', contact({ position: 'latest' })));

		expect(flat(query.sql)).toContain(
			'ORDER BY tla.created_at DESC, tla.id DESC LIMIT 1 OFFSET $2) picked WHERE picked.contact_made = $1'
		);
		expect(query.params).toEqual([true, 0]);
	});

	it('skips the newer attempts for "from the last"', () => {
		expect(loc(group('AND', contact({ position: 'nth_from_last', n: 3 }))).params).toEqual([true, 2]);
	});

	it('narrows to a bucket and a list through the turfs they were cut into', () => {
		const query = loc(group('AND', contact({ bucketId: BUCKET, listId: LIST })));

		expect(flat(query.sql)).toContain(
			'JOIN universe.turf tt ON tt.id = tl.turf_id JOIN universe.list tli ON tli.id = tt.list_id'
		);
		expect(flat(query.sql)).toContain('tt.list_id = $1 AND tli.bucket = $2');
		expect(flat(query.sql)).toContain('tla.contact_made = $3');
		expect(query.params).toEqual([LIST, BUCKET, true]);
	});

	it('does not join turfs when no bucket or list is chosen', () => {
		expect(loc(group('AND', contact())).sql).not.toContain('universe.turf tt');
	});

	it('includes the whole end date in a time range', () => {
		const query = loc(group('AND', contact({ from: '2026-01-01', to: '2026-01-31' })));

		expect(flat(query.sql)).toContain('tla.created_at >= $1::date AND tla.created_at < ($2::date + 1)');
		expect(query.params).toEqual(['2026-01-01', '2026-01-31', true]);
	});

	it('applies the scope before picking the latest attempt', () => {
		const sql = flat(loc(group('AND', contact({ position: 'latest', from: '2026-01-01' }))).sql);

		expect(sql.indexOf('tla.created_at >=')).toBeLessThan(sql.indexOf('ORDER BY tla.created_at DESC'));
	});

	it('compares the date of the most recent attempt for last canvassed', () => {
		const query = loc(group('AND', f('last_canvassed', 'less_than', '2026-01-01')));

		expect(flat(query.sql)).toContain('(SELECT max(tla.created_at) FROM universe.turf_location_attempt tla');
		expect(flat(query.sql)).toContain(')::date < $1::date');
		expect(query.params).toEqual(['2026-01-01']);
	});

	it('numbers the parameters of several canvassing filters in order', () => {
		const query = loc(
			group('AND', contact({ from: '2026-01-01' }), f('last_canvassed', 'greater_than', '2026-02-01'), f('city', 'equals', 'Austin'))
		);

		expect(query.params).toEqual(['2026-01-01', true, '2026-02-01', 'Austin']);
		expect(query.sql).toContain('lower(vl.city) = lower($4)');
	});

	it('only applies to locations', () => {
		expect(() => people(group('AND', contact()))).toThrow();
		expect(() => people(group('AND', f('last_canvassed', 'less_than', '2026-01-01')))).toThrow();
	});
});

describe('groups', () => {
	it('joins AND and OR with parentheses and numbers parameters in order', () => {
		const query = loc(
			group(
				'AND',
				f('city', 'equals', 'Austin'),
				group('OR', f('state', 'equals', 'TX'), f('zip_code', 'starts_with', '787'))
			)
		);

		expect(query.sql).toBe(
			`${LOC} WHERE (lower(vl.city) = lower($1)` +
				` AND (lower(vl.state_or_region) = lower($2) OR vl.postal_code ILIKE $3))`
		);
		expect(query.params).toEqual(['Austin', 'TX', '787%']);
	});

	it('drops an empty group from an AND', () => {
		expect(loc(group('AND', f('city', 'equals', 'Austin'), group('OR'))).sql).toBe(
			`${LOC} WHERE (lower(vl.city) = lower($1))`
		);
	});

	it('lets an empty group make an OR match everything', () => {
		expect(loc(group('OR', f('city', 'equals', 'Austin'), group('AND')))).toEqual({
			sql: LOC,
			params: []
		});
	});

	it('does not leave a parameter behind for a discarded branch', () => {
		const query = loc(group('AND', group('OR', f('city', 'equals', 'A'), group('AND')), f('state', 'equals', 'TX')));

		expect(query.params).toEqual(['TX']);
		expect(query.sql).toBe(`${LOC} WHERE (lower(vl.state_or_region) = lower($1))`);
	});
});

describe('inverted groups', () => {
	const not = (operator: 'AND' | 'OR', ...filters: unknown[]) => ({ operator, not: true, filters });
	const flat = (sql: string) => sql.replace(/\s+/g, ' ');

	it('inverts an OR so that none of its filters match', () => {
		const query = loc(not('OR', f('city', 'equals', 'Austin'), f('state', 'equals', 'TX')));

		expect(flat(query.sql)).toBe(
			`${LOC} WHERE NOT (COALESCE((lower(vl.city) = lower($1)), false)` +
				` OR COALESCE((lower(vl.state_or_region) = lower($2)), false))`
		);
		expect(query.params).toEqual(['Austin', 'TX']);
	});

	it('inverts an AND so that not all of its filters match', () => {
		expect(loc(not('AND', f('city', 'equals', 'Austin'), f('state', 'equals', 'TX'))).sql).toContain(
			'NOT (COALESCE((lower(vl.city) = lower($1)), false) AND '
		);
	});

	it('counts a condition that cannot be decided as not matching, so inverting includes it', () => {
		// age is unknown without a date of birth: "none of: age over 65" must still include those people
		expect(people(not('OR', f('age', 'greater_than', 65))).sql).toContain(
			'NOT (COALESCE((EXTRACT(YEAR FROM AGE(CURRENT_DATE, vp.dob)) > $1), false))'
		);
	});

	it('leaves conditions outside an inverted group as they were', () => {
		const query = loc(group('AND', f('city', 'equals', 'Austin'), not('OR', f('state', 'equals', 'TX'))));

		expect(flat(query.sql)).toContain('(lower(vl.city) = lower($1) AND NOT (COALESCE(');
	});

	it('inverts twice back to the original meaning', () => {
		const query = loc(not('OR', not('OR', f('city', 'equals', 'Austin'))));

		// Two inversions cancel, so the condition needs no guard: an unknown value is excluded either way.
		expect(flat(query.sql)).toBe(`${LOC} WHERE NOT (NOT (lower(vl.city) = lower($1)))`);
	});

	it('places no restriction when the inverted group is empty', () => {
		expect(loc(not('OR'))).toEqual({ sql: LOC, params: [] });
		expect(loc(group('AND', f('city', 'equals', 'Austin'), not('AND'))).sql).toBe(
			`${LOC} WHERE (lower(vl.city) = lower($1))`
		);
	});

	it('matches nothing when everything is excluded', () => {
		// "none of: (an empty group)": the empty group matches everything, so none of it can match
		expect(loc(not('OR', group('AND')))).toEqual({ sql: `${LOC} WHERE false`, params: [] });
	});

	it('lets an always-true branch settle an OR and drop out of an AND, under inversion too', () => {
		expect(loc(not('AND', f('city', 'equals', 'Austin'), group('AND'))).sql).toContain('WHERE NOT (');
		expect(loc(group('OR', f('city', 'equals', 'Austin'), not('OR', group('AND'))))).toMatchObject({
			params: ['Austin']
		});
	});

	it('numbers the parameters of filters on either side of an inverted group in order', () => {
		const query = loc(
			group('AND', f('city', 'equals', 'A'), not('OR', f('state', 'equals', 'B')), f('zip_code', 'equals', '1'))
		);

		expect(query.params).toEqual(['A', 'B', '1']);
		expect(query.sql).toContain('lower(vl.postal_code) = lower($3)');
	});

	it('matches nothing when an always-true branch sits in an inverted OR, and clears its parameters', () => {
		// "none of: (state is B, anything)" can never match, which settles the AND around it
		const query = loc(group('AND', f('city', 'equals', 'A'), not('OR', f('state', 'equals', 'B'), group('AND'))));

		expect(query).toEqual({ sql: `${LOC} WHERE false`, params: [] });
	});

	it('is refused when `not` is not a boolean', () => {
		expect(() => loc({ operator: 'OR', not: 'yes', filters: [] })).toThrow();
	});
});

describe('selected columns', () => {
	it('selects only what is asked for, from the entity view', () => {
		expect(buildFilterQuery('locations', group('AND'), { columns: ['id', 'name', 'city'] }).sql).toBe(
			'SELECT vl.id, vl.name, vl.city FROM universe.v_locations vl'
		);
		expect(buildFilterQuery('people', group('AND'), { columns: ['id', 'last_name'] }).sql).toBe(
			'SELECT vp.id, vp.last_name FROM universe.v_people vp'
		);
	});

	it('refuses a column the entity does not have', () => {
		expect(() => buildFilterQuery('people', group('AND'), { columns: ['city'] })).toThrow(/Unknown people columns: city/);
		expect(() =>
			buildFilterQuery('locations', group('AND'), { columns: ['id; DROP TABLE x'] })
		).toThrow();
	});
});

describe('refusals', () => {
	const rejects = (run: () => unknown, status: number) => {
		try {
			run();
		} catch (e) {
			expect(e).toMatchObject({ status });
			return;
		}
		throw new Error('expected a refusal');
	};

	it.each([
		['an incomplete filter', group('AND', f('city', 'equals', ''))],
		['an unknown filter', group('AND', f('shoe_size', 'equals', 'x'))],
		['a disallowed operation', group('AND', f('city', 'greater_than', 'x'))],
		['something that is not a group', 'city = Austin']
	])('answers 400 for %s', (_name, doc) => {
		rejects(() => loc(doc), 400);
	});

	it('says what is wrong', () => {
		try {
			loc(group('AND', f('city', 'equals', '')));
		} catch (e) {
			expect((e as { body: { message: string } }).body.message).toBe('City needs a valid value');
		}
	});

	it('answers 400 for a filter that does not apply to the entity type', () => {
		rejects(() => people(group('AND', f('city', 'equals', 'Austin'))), 400);
		rejects(() => loc(group('AND', f('first_name', 'equals', 'Al'))), 400);
	});

	it('answers 501 rather than ignoring a filter it cannot compile yet', () => {
		rejects(
			() =>
				loc(
					group(
						'AND',
						f('survey_question_response', 'equals', {
							bucketId: 'b1b2c3d4-e5f6-7890-abcd-ef1234567890',
							surveyId: 'b1b2c3d4-e5f6-7890-abcd-ef1234567890',
							questionId: 'b1b2c3d4-e5f6-7890-abcd-ef1234567890',
							response: 'Yes'
						})
					)
				),
			501
		);
	});
});


// TEMPORARY: removed with the old filter column (see issue #221).
describe('legacy bucket filters', () => {
	const off = { enabled: false, matchType: 'ONE_OR_MORE' as MatchType, conditions: [] };

	/** Runs the old pipeline end to end: form input to stored query to editor document. */
	function convertInput(input: Partial<BucketFilterInput>) {
		return convertLegacyBucketFilter(convertBucketFilter({ people: off, locations: off, ...input }));
	}

	const locations = (matchType: MatchType, ...conditions: [string, string, string][]) => ({
		locations: {
			enabled: true,
			matchType,
			conditions: conditions.map(([filterId, qualifierId, value]) => ({ filterId, qualifierId, value }))
		}
	});
	const people = (matchType: MatchType, ...conditions: [string, string, string][]) => ({
		people: {
			enabled: true,
			matchType,
			conditions: conditions.map(([filterId, qualifierId, value]) => ({ filterId, qualifierId, value }))
		}
	});

	describe('which kinds of record are included', () => {
		it('is null for a kind the bucket did not include', () => {
			expect(convertInput({})).toEqual({ v: 2, people: null, locations: null });
		});

		it('is an empty group for a kind included with no conditions', () => {
			expect(convertInput(locations('ALL'))).toEqual({
				v: 2,
				people: null,
				locations: { operator: 'AND', filters: [] }
			});
		});

		it('converts both kinds side by side', () => {
			const doc = convertInput({
				...locations('ALL', ['city', 'is', 'Austin']),
				...people('ALL', ['first_name', 'is', 'Al'])
			});

			expect(doc.locations?.filters).toHaveLength(1);
			expect(doc.people?.filters).toHaveLength(1);
		});

		it('treats an empty stored filter as including nothing', () => {
			const empty: StoredBucketFilter = {
				v: 1,
				people: { enabled: false, query: null },
				locations: { enabled: false, query: null }
			};

			expect(convertLegacyBucketFilter(empty)).toEqual({ v: 2, people: null, locations: null });
		});
	});

	describe('how conditions combine', () => {
		const two: [string, string, string][] = [
			['city', 'is', 'Austin'],
			['state', 'is', 'TX']
		];

		it('"all" is an AND', () => {
			expect(convertInput(locations('ALL', ...two)).locations).toMatchObject({ operator: 'AND' });
			expect(convertInput(locations('ALL', ...two)).locations).not.toHaveProperty('not');
		});

		it('"one or more" is an OR', () => {
			expect(convertInput(locations('ONE_OR_MORE', ...two)).locations).toMatchObject({ operator: 'OR' });
		});

		it('"none" is inverted, and keeps the AND it was stored with', () => {
			// The old converter documented "none" as NOT (a OR b) but stored NOT (a AND b),
			// so those buckets select what is not all of the conditions. The conversion
			// keeps what they select; the editor shows it as "Not all of the following".
			expect(convertInput(locations('NONE', ...two)).locations).toMatchObject({ operator: 'AND', not: true });
		});

		it('agrees with a single "none" condition however it is read', () => {
			expect(convertInput(locations('NONE', ['city', 'is', 'Austin'])).locations).toMatchObject({ not: true });
		});

		it('keeps the conditions in order', () => {
			const filters = convertInput(locations('ALL', ...two)).locations!.filters;

			expect(filters.map((f) => ('item' in f ? f.item : null))).toEqual(['city', 'state']);
		});
	});

	describe('text conditions', () => {
		const one = (qualifier: string, value: string, filterId = 'city') =>
			convertInput(locations('ALL', [filterId, qualifier, value])).locations!.filters[0];

		it('keeps "is" and "is not" exact, as they always were', () => {
			expect(one('is', 'Austin')).toEqual({ item: 'city', operation: 'equals', value: 'Austin', caseSensitive: true });
			expect(one('is_not', 'Austin')).toEqual({ item: 'city', operation: 'not_equals', value: 'Austin', caseSensitive: true });
		});

		it('keeps "contains" and "starts with" ignoring case, as they always did', () => {
			expect(one('contains', 'phil')).toEqual({ item: 'city', operation: 'contains', value: 'phil' });
			expect(one('starts_with', '191', 'zip_code')).toEqual({ item: 'zip_code', operation: 'starts_with', value: '191' });
		});

		it('maps each location column to its filter', () => {
			expect(one('is', 'TX', 'state')).toMatchObject({ item: 'state' });
			expect(one('is', '19104', 'zip_code')).toMatchObject({ item: 'zip_code' });
		});

		it('maps each person column to its filter', () => {
			const doc = convertInput(people('ALL', ['first_name', 'contains', 'al'], ['last_name', 'is', 'Smith']));

			expect(doc.people!.filters).toEqual([
				{ item: 'first_name', operation: 'contains', value: 'al' },
				{ item: 'last_name', operation: 'equals', value: 'Smith', caseSensitive: true }
			]);
		});

		it.each([['50%'], ['a_b'], ['back\\slash']])('refuses text with wildcards or escapes of its own (%s)', (text) => {
			expect(() => convertInput(locations('ALL', ['city', 'contains', text]))).toThrow(LegacyFilterError);
		});

		it('refuses a blank value, which the editor does not allow', () => {
			expect(() => convertInput(locations('ALL', ['city', 'is', '']))).toThrow(LegacyFilterError);
		});
	});

	describe('person conditions', () => {
		const one = (...condition: [string, string, string]) =>
			convertInput(people('ALL', condition)).people!.filters[0];

		it.each([
			['eq', 'equals'],
			['gt', 'greater_than'],
			['lt', 'less_than'],
			['gte', 'greater_than_or_equal'],
			['lte', 'less_than_or_equal']
		])('converts the age qualifier %s', (qualifier, operation) => {
			expect(one('age', qualifier, '65')).toEqual({ item: 'age', operation, value: 65 });
		});

		it.each([
			['after', 'greater_than'],
			['before', 'less_than'],
			['not_after', 'less_than_or_equal'],
			['not_before', 'greater_than_or_equal']
		])('converts the date of birth qualifier %s', (qualifier, operation) => {
			expect(one('dob', qualifier, '1990-01-01')).toEqual({ item: 'date_of_birth', operation, value: '1990-01-01' });
		});

		it('converts having an email or phone', () => {
			expect(one('has_email', '', '')).toEqual({ item: 'has_email', operation: 'equals', value: true });
			expect(one('has_phone', '', '')).toEqual({ item: 'has_phone', operation: 'equals', value: true });
		});

		it('refuses a date that is not a date', () => {
			expect(() => convertInput(people('ALL', ['dob', 'after', 'last week']))).toThrow(LegacyFilterError);
		});
	});

	describe('what cannot be converted', () => {
		const stored = (where: unknown): StoredBucketFilter => ({
			v: 1,
			people: { enabled: false, query: null },
			locations: {
				enabled: true,
				query: { select: ['vl.id'], from: 'universe.v_locations vl', where: where as never }
			}
		});
		const group = (children: unknown[], negate = false) => ({ type: 'group', connector: 'AND', negate, children });
		const cond = (column: string, op: string, value?: unknown, negate = false) => ({
			type: 'condition',
			column,
			op,
			negate,
			value
		});

		it('refuses a column no filter reads', () => {
			expect(() => convertLegacyBucketFilter(stored(group([cond('vl.name', '=', 'x')])))).toThrow(/vl\.name/);
		});

		it('refuses a person column in a location filter', () => {
			expect(() => convertLegacyBucketFilter(stored(group([cond('vp.first_name', '=', 'x')])))).toThrow(LegacyFilterError);
		});

		it('refuses an operator it does not know', () => {
			expect(() => convertLegacyBucketFilter(stored(group([cond('vl.city', 'SIMILAR TO', 'x')])))).toThrow(LegacyFilterError);
		});

		it('refuses a condition that is inverted on its own', () => {
			expect(() => convertLegacyBucketFilter(stored(group([cond('vl.city', '=', 'x', true)])))).toThrow(/inverted/);
		});

		it('names the kind of record in the message', () => {
			expect(() => convertLegacyBucketFilter(stored(group([cond('vl.name', '=', 'x')])))).toThrow(/^locations: /);
		});

		it('converts nested groups', () => {
			const doc = convertLegacyBucketFilter(
				stored(group([cond('vl.city', '=', 'A'), group([cond('vl.state_or_region', '=', 'B')], true)]))
			);

			expect(doc.locations?.filters[1]).toMatchObject({ operator: 'AND', not: true });
		});
	});

	describe('the converted document', () => {
		it('compiles to the query of a bucket that was converted', () => {
			const doc = convertInput(
				locations('NONE', ['city', 'is', 'Austin'], ['zip_code', 'starts_with', '787'])
			);

			const query = buildFilterQuery('locations', doc.locations);

			expect(query.sql).toContain('NOT (');
			expect(query.params).toEqual(['Austin', '787%']);
		});

		it('compiles a converted person filter', () => {
			const doc = convertInput(people('ALL', ['age', 'gte', '18'], ['has_email', '', '']));

			expect(() => buildFilterQuery('people', doc.people)).not.toThrow();
		});
	});
});
