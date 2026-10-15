import { describe, it, expect } from 'vitest';
import { buildFilterQuery } from './filters.service';

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
