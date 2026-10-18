/**
 * Splits SQL into runs an IDE would color differently, for the demo's
 * syntax highlighting. Whitespace is kept as `plain` runs, so joining every
 * run's text gives back the input unchanged, layout included.
 */

export type SqlTokenKind =
	| 'keyword'
	| 'function'
	| 'type'
	| 'string'
	| 'number'
	| 'param'
	| 'punctuation'
	| 'plain';

export interface SqlToken {
	text: string;
	kind: SqlTokenKind;
}

const KEYWORDS = new Set([
	'SELECT',
	'DISTINCT',
	'FROM',
	'WHERE',
	'JOIN',
	'LEFT',
	'INNER',
	'ON',
	'AS',
	'AND',
	'OR',
	'NOT',
	'EXISTS',
	'IN',
	'IS',
	'NULL',
	'TRUE',
	'FALSE',
	'LIKE',
	'ILIKE',
	'BETWEEN',
	'ORDER',
	'BY',
	'ASC',
	'DESC',
	'LIMIT',
	'OFFSET',
	'CASE',
	'WHEN',
	'THEN',
	'ELSE',
	'END',
	'YEAR',
	'CURRENT_DATE'
]);

/** Quoted strings, parameters, casts, numbers, words, whitespace, then any single character. */
const TOKEN = /'(?:[^']|'')*'|\$\d+|::|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|\s+|./g;

function kindOf(
	token: string,
	previous: string | undefined,
	next: string | undefined
): SqlTokenKind {
	if (token.startsWith("'")) return 'string';
	if (/^\$\d+$/.test(token)) return 'param';
	if (/^\d/.test(token)) return 'number';
	if (/^\s+$/.test(token)) return 'plain';
	if (/^[A-Za-z_]/.test(token)) {
		if (previous === '::') return 'type';
		if (KEYWORDS.has(token.toUpperCase())) return 'keyword';
		if (next === '(') return 'function';
		return 'plain';
	}
	return 'punctuation';
}

export function highlightSql(sql: string): SqlToken[] {
	const tokens = sql.match(TOKEN) ?? [];
	const out: SqlToken[] = [];

	tokens.forEach((text, i) => {
		const kind = kindOf(text, tokens[i - 1], tokens[i + 1]);
		const last = out[out.length - 1];
		// Adjacent runs of the same kind share a span.
		if (last && last.kind === kind) last.text += text;
		else out.push({ text, kind });
	});

	return out;
}
