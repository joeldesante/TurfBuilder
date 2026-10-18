import { describe, expect, test } from 'vitest';
import { highlightSql, type SqlTokenKind } from './highlight-sql';

/** The runs of one kind, in order. */
function runs(sql: string, kind: SqlTokenKind): string[] {
	return highlightSql(sql)
		.filter((t) => t.kind === kind)
		.map((t) => t.text);
}

describe('highlightSql', () => {
	test('gives back the input when the runs are joined', () => {
		const sql =
			"SELECT vl.id\nFROM v vl\nWHERE (\n\tlower(vl.city) = lower($1)\n\tAND vl.note <> 'it''s'\n)";

		expect(
			highlightSql(sql)
				.map((t) => t.text)
				.join('')
		).toBe(sql);
	});

	test('marks keywords in any case', () => {
		expect(runs('select vl.id FROM v vl WHERE vl.x IS NOT NULL', 'keyword')).toEqual([
			'select',
			'FROM',
			'WHERE',
			'IS',
			'NOT',
			'NULL'
		]);
	});

	test('marks function calls but not keywords before a parenthesis', () => {
		const sql = 'WHERE EXISTS (SELECT 1) AND lower(vl.city) = COALESCE(vl.x, $1)';

		expect(runs(sql, 'function')).toEqual(['lower', 'COALESCE']);
		expect(runs(sql, 'keyword')).toContain('EXISTS');
	});

	test('marks parameters, numbers, strings, and cast types', () => {
		const sql = "ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography AND x = 'a''b'";

		expect(runs(sql, 'param')).toEqual(['$1', '$2']);
		expect(runs(sql, 'number')).toEqual(['4326']);
		expect(runs(sql, 'type')).toEqual(['float8', 'float8', 'geography']);
		expect(runs(sql, 'string')).toEqual(["'a''b'"]);
	});

	test('leaves identifiers with digits in them plain', () => {
		expect(runs('FROM universe.v_locations2 vl', 'number')).toEqual([]);
	});
});
