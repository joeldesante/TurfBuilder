/**
 * Lays out the one-line SQL from `buildFilterQuery` for reading: each clause
 * and each AND/OR on its own line, subqueries and condition groups indented
 * with tabs. Only meant for the demo; it knows the shapes the filter compiler
 * produces, not SQL in general.
 */

/** Keywords that start a new line when they sit directly in a block. */
const CLAUSES = new Set(['FROM', 'WHERE', 'JOIN', 'LEFT', 'ORDER', 'LIMIT', 'AND', 'OR']);

/** Splits into quoted strings, parentheses, whitespace runs, and everything else. */
function tokenize(sql: string): string[] {
	return sql.match(/'(?:[^']|'')*'|[()]|\s+|[^\s()']+/g) ?? [];
}

/**
 * Whether the parenthesis opening at `open` holds a subquery, an AND/OR
 * group, or another such block, as opposed to a function call or arithmetic
 * that stays inline.
 */
function isBlock(tokens: string[], open: number): boolean {
	let depth = 0;
	let first = true;
	for (let i = open + 1; i < tokens.length; i++) {
		const token = tokens[i];
		if (token === '(') {
			if (depth === 0 && isBlock(tokens, i)) return true;
			depth++;
		} else if (token === ')') {
			if (depth === 0) return false;
			depth--;
		} else if (depth === 0 && token.trim()) {
			const word = token.toUpperCase();
			if (first && word === 'SELECT') return true;
			if (word === 'AND' || word === 'OR') return true;
			first = false;
		}
	}
	return false;
}

export function formatSql(sql: string): string {
	const tokens = tokenize(sql);
	/** For each open parenthesis, whether it is a block. */
	const stack: boolean[] = [];
	let indent = 0;
	let out = '';
	let previousWord = '';

	const newline = () => {
		out = out.trimEnd() + '\n' + '\t'.repeat(indent);
	};
	const atLineStart = () => /\n\t*$/.test(out) || out === '';

	tokens.forEach((token, i) => {
		if (/^\s+$/.test(token)) {
			if (!atLineStart()) out += ' ';
			return;
		}

		if (token === '(') {
			const block = isBlock(tokens, i);
			stack.push(block);
			out += '(';
			if (block) {
				indent++;
				newline();
			}
		} else if (token === ')') {
			if (stack.pop()) {
				indent--;
				newline();
			}
			out += ')';
		} else {
			const word = token.toUpperCase();
			const inBlock = stack.length === 0 || stack[stack.length - 1];
			const continuesJoin = word === 'JOIN' && previousWord === 'LEFT';
			if (inBlock && CLAUSES.has(word) && !continuesJoin && !atLineStart()) newline();
			out += token;
			previousWord = word;
		}
	});

	return out.trim();
}
