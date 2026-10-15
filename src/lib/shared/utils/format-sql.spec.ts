import { describe, expect, test } from 'vitest';
import { formatSql } from './format-sql';

describe('formatSql', () => {
	test('puts each clause on its own line', () => {
		expect(formatSql('SELECT vl.id, vl.source FROM universe.v_locations vl')).toBe(
			'SELECT vl.id, vl.source\nFROM universe.v_locations vl'
		);
	});

	test('indents condition groups and breaks before AND and OR', () => {
		expect(
			formatSql(
				'SELECT vl.id FROM v vl WHERE (vl.city ILIKE $1 AND (lower(vl.state) = lower($2) OR vl.zip LIKE $3))'
			)
		).toBe(
			[
				'SELECT vl.id',
				'FROM v vl',
				'WHERE (',
				'\tvl.city ILIKE $1',
				'\tAND (',
				'\t\tlower(vl.state) = lower($2)',
				'\t\tOR vl.zip LIKE $3',
				'\t)',
				')'
			].join('\n')
		);
	});

	test('indents subqueries and keeps LEFT JOIN together', () => {
		expect(
			formatSql(
				'SELECT p.id FROM v p WHERE (EXISTS (SELECT 1 FROM a LEFT JOIN b ON b.id = a.b_id WHERE a.x = $1))'
			)
		).toBe(
			[
				'SELECT p.id',
				'FROM v p',
				'WHERE (',
				'\tEXISTS (',
				'\t\tSELECT 1',
				'\t\tFROM a',
				'\t\tLEFT JOIN b ON b.id = a.b_id',
				'\t\tWHERE a.x = $1',
				'\t)',
				')'
			].join('\n')
		);
	});

	test('leaves keywords inside function calls and strings alone', () => {
		expect(
			formatSql(
				"SELECT p.id FROM v p WHERE (EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.dob)) > $1 AND NULLIF(p.email, '') IS NULL)"
			)
		).toBe(
			[
				'SELECT p.id',
				'FROM v p',
				'WHERE (',
				'\tEXTRACT(YEAR FROM AGE(CURRENT_DATE, p.dob)) > $1',
				"\tAND NULLIF(p.email, '') IS NULL",
				')'
			].join('\n')
		);
	});
});
