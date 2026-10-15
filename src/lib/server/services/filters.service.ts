import { error } from '@sveltejs/kit';
import { filterGroupSchema } from '$lib/shared/schemas/filters';
import { getFilter } from '$lib/shared/utils/filter-registry';
import { isFilterGroup } from '$lib/shared/utils/filters';
import type { ConditionNode, GroupNode, WhereNode } from '$lib/server/query-builder';
import type { StoredBucketFilter, StoredEntityFilter } from '$lib/server/filter-converter';
import type {
	AttemptScope,
	BucketFilters,
	FilterEntity,
	ContactMadeValue,
	Filter,
	FilterGroup,
	FilterOperation,
	RadiusValue,
	SurveyResponseValue
} from '$lib/shared/types/filters';

export type { FilterEntity };

export interface FilterQuery {
	/** Selects the requested columns of every record that matches. Parameterized with `$n`. */
	sql: string;
	params: unknown[];
}

const METERS_PER_MILE = 1609.344;

const ENTITY_VIEWS: Record<FilterEntity, { from: string; alias: string }> = {
	people: { from: 'universe.v_people', alias: 'vp' },
	locations: { from: 'universe.v_locations', alias: 'vl' }
};

/** What a handler needs to write SQL for one filter. */
interface Context {
	/** The alias of the entity view in the query, such as `vl`. */
	alias: string;
	/** Registers a value as a query parameter and returns its placeholder. */
	param: (value: unknown) => string;
	/** The parameters registered so far, in placeholder order. */
	params: unknown[];
}

interface Handler {
	/** SQL for the filter, with every value passed through `ctx.param`. */
	build: (filter: Filter, ctx: Context) => string;
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** Escapes LIKE wildcards so user text matches literally. */
function escapeLike(text: string): string {
	return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Text comparison. Case is ignored unless the filter asks for it to match. */
function textCondition(column: string, filter: Filter, ctx: Context): string {
	const text = String(filter.value);
	const exact = filter.caseSensitive === true;

	switch (filter.operation) {
		case 'equals':
			return exact
				? `${column} = ${ctx.param(text)}`
				: `lower(${column}) = lower(${ctx.param(text)})`;
		case 'not_equals':
			// IS DISTINCT FROM keeps rows where the column is empty: they are not equal to the text.
			return exact
				? `${column} IS DISTINCT FROM ${ctx.param(text)}`
				: `lower(${column}) IS DISTINCT FROM lower(${ctx.param(text)})`;
		case 'contains':
			return `${column} ${exact ? 'LIKE' : 'ILIKE'} ${ctx.param(`%${escapeLike(text)}%`)}`;
		case 'starts_with':
			return `${column} ${exact ? 'LIKE' : 'ILIKE'} ${ctx.param(`${escapeLike(text)}%`)}`;
		default:
			throw unsupported(filter);
	}
}

const COMPARISONS: Record<string, string> = {
	equals: '=',
	greater_than: '>',
	less_than: '<',
	greater_than_or_equal: '>=',
	less_than_or_equal: '<='
};

/** Number or date comparison; `cast` types the parameter, such as `date`. */
function comparison(expression: string, filter: Filter, ctx: Context, cast = ''): string {
	const op = COMPARISONS[filter.operation];
	if (!op) throw unsupported(filter);
	return `${expression} ${op} ${ctx.param(filter.value)}${cast}`;
}

/** Whether a column holds a value, treating an empty string as missing. */
function presence(column: string, filter: Filter): string {
	const has = filter.value === true;
	return `NULLIF(${column}, '') IS ${has ? 'NOT NULL' : 'NULL'}`;
}

function unsupported(filter: Filter): Error {
	return error(400, `The operation "${filter.operation}" is not supported for "${filter.item}"`);
}

/** Wraps a condition for within / not_within. A record with no position is not within anything. */
function withinOrNot(filter: Filter, condition: string): string {
	if (filter.operation === 'within') return `COALESCE(${condition}, false)`;
	if (filter.operation === 'not_within') return `NOT COALESCE(${condition}, false)`;
	throw unsupported(filter);
}

/**
 * A subquery over the canvassing attempts at the location being filtered,
 * narrowed by `scope`. Each turf location holds the version of the location
 * that was current when the turf was cut, so attempts are matched to the
 * location through its entity id, which every version shares. Reads
 * `entity_id` from the entity view alias, so it must sit inside that query.
 */
function attemptsAt(
	select: string,
	ctx: Context,
	scope: Partial<Pick<AttemptScope, 'bucketId' | 'listId' | 'from' | 'to'>> = {}
): string {
	const joins: string[] = [];
	const where = [`COALESCE(tpl.entity_id, tol.entity_id) = ${ctx.alias}.entity_id`];

	if (scope.bucketId || scope.listId) {
		joins.push('JOIN universe.turf tt ON tt.id = tl.turf_id');
	}
	if (scope.listId) where.push(`tt.list_id = ${ctx.param(scope.listId)}`);
	if (scope.bucketId) {
		joins.push('JOIN universe.list tli ON tli.id = tt.list_id');
		where.push(`tli.bucket = ${ctx.param(scope.bucketId)}`);
	}
	// Both ends are whole days: the end date includes everything made on it.
	if (scope.from) where.push(`tla.created_at >= ${ctx.param(scope.from)}::date`);
	if (scope.to) where.push(`tla.created_at < (${ctx.param(scope.to)}::date + 1)`);

	return (
		`SELECT ${select} FROM universe.turf_location_attempt tla` +
		` JOIN universe.turf_location tl ON tl.id = tla.turf_location_id` +
		` LEFT JOIN universe.public_location tpl ON tpl.id = tl.public_location_id` +
		` LEFT JOIN universe.org_location tol ON tol.id = tl.org_location_id` +
		(joins.length ? ` ${joins.join(' ')}` : '') +
		` WHERE ${where.join(' AND ')}`
	);
}

/**
 * Whether the response to a survey question is the choice, or contains the
 * text, being looked for. A question of choose-many saves its choices as one
 * comma-separated value, so for those the choice is looked for among them;
 * for every other kind of question the whole answer is what is compared.
 */
function answerMatches(operation: Filter['operation'], filter: Filter, ctx: Context): string {
	const answer = 'sqr.response_value';
	const text = String((filter.value as SurveyResponseValue).response);

	// Case is ignored: the filter has no option to match it, as only text filters do.
	if (operation === 'contains') {
		return `${answer} ILIKE ${ctx.param(`%${escapeLike(text)}%`)}`;
	}

	const wanted = ctx.param(text);
	return (
		`CASE WHEN sq.question_type = 'check'` +
		` THEN lower(${wanted}) = ANY(string_to_array(lower(${answer}), ','))` +
		` ELSE lower(${answer}) = lower(${wanted}) END`
	);
}

/**
 * Locations that were given a particular response to a survey question, on any
 * attempt. Responses are matched to the location through its entity id, as
 * attempts are, so a response made on an older version of the location still
 * counts. "Is not" means answered with something else, so a location that was
 * never asked is left out; invert the group to include it.
 */
function surveyResponse(filter: Filter, ctx: Context): string {
	const value = filter.value as SurveyResponseValue;
	const exists = (condition: string) =>
		`EXISTS (SELECT 1 FROM universe.survey_question_response sqr` +
		` JOIN universe.survey_question sq ON sq.id = sqr.survey_question_id` +
		` JOIN universe.turf_location_attempt tla ON tla.id = sqr.turf_location_attempt_id` +
		` JOIN universe.turf_location tl ON tl.id = tla.turf_location_id` +
		` LEFT JOIN universe.public_location tpl ON tpl.id = tl.public_location_id` +
		` LEFT JOIN universe.org_location tol ON tol.id = tl.org_location_id` +
		` WHERE sqr.survey_question_id = ${ctx.param(value.questionId)}::uuid` +
		` AND COALESCE(tpl.entity_id, tol.entity_id) = ${ctx.alias}.entity_id` +
		` AND ${condition})`;

	switch (filter.operation) {
		case 'equals':
		case 'contains':
			return exists(answerMatches(filter.operation, filter, ctx));
		case 'not_equals':
			return exists(
				`COALESCE(sqr.response_value, '') <> '' AND NOT ${answerMatches('equals', filter, ctx)}`
			);
		default:
			throw unsupported(filter);
	}
}

/** Whether the attempt picked by `position` (and in scope) did or did not make contact. */
function contactMade(value: ContactMadeValue, ctx: Context): string {
	const attempts = attemptsAt('tla.contact_made', ctx, value);
	const contacted = ctx.param(value.contacted);

	if (value.position === 'any') {
		return `EXISTS (${attempts} AND tla.contact_made = ${contacted})`;
	}

	// The attempts newest first; the id breaks ties so the pick is stable.
	const behind = value.position === 'latest' ? 0 : (value.n ?? 2) - 1;
	return (
		`EXISTS (SELECT 1 FROM (${attempts} ORDER BY tla.created_at DESC, tla.id DESC` +
		` LIMIT 1 OFFSET ${ctx.param(behind)}) picked WHERE picked.contact_made = ${contacted})`
	);
}

// ---------------------------------------------------------------------------
// One handler per filter id in the registry. This table is the allowlist: only
// SQL written here ever reaches the database, and values only as parameters.
// ---------------------------------------------------------------------------

/** Ids of the filters that can be compiled. Every registry filter is expected to be one. */
export const COMPILED_FILTER_IDS = (): string[] => Object.keys(HANDLERS);

const HANDLERS: Record<string, Handler> = {
	city: {
		build: (f, ctx) => textCondition(`${ctx.alias}.city`, f, ctx)
	},
	state: {
		build: (f, ctx) => textCondition(`${ctx.alias}.state_or_region`, f, ctx)
	},
	zip_code: {
		build: (f, ctx) => textCondition(`${ctx.alias}.postal_code`, f, ctx)
	},
	radius_from_point: {
		build: (f, ctx) => {
			const area = f.value as RadiusValue;
			const point = `ST_SetSRID(ST_MakePoint(${ctx.param(area.longitude)}::float8, ${ctx.param(area.latitude)}::float8), 4326)::geography`;
			const meters = `${ctx.param(area.radius * METERS_PER_MILE)}::float8`;
			return withinOrNot(f, `ST_DWithin(${ctx.alias}.coordinates::geography, ${point}, ${meters})`);
		}
	},
	inside_drawn_region: {
		build: (f, ctx) => {
			const region = `ST_SetSRID(ST_GeomFromGeoJSON(${ctx.param(JSON.stringify(f.value))}), 4326)`;
			return withinOrNot(f, `ST_Intersects(${ctx.alias}.coordinates, ${region})`);
		}
	},
	contact_made: {
		build: (f, ctx) => {
			if (f.operation !== 'equals') throw unsupported(f);
			return contactMade(f.value as ContactMadeValue, ctx);
		}
	},
	canvassed: {
		build: (f, ctx) => {
			if (f.operation !== 'equals') throw unsupported(f);
			// Any attempt counts, whether or not anyone answered the door.
			return `${f.value === true ? '' : 'NOT '}EXISTS (${attemptsAt('1', ctx)})`;
		}
	},
	last_canvassed: {
		build: (f, ctx) =>
			// A location never canvassed has no date, so every comparison leaves it out.
			comparison(`(${attemptsAt('max(tla.created_at)', ctx)})::date`, f, ctx, '::date')
	},
	survey_question_response: {
		build: (f, ctx) => surveyResponse(f, ctx)
	},
	first_name: {
		build: (f, ctx) => textCondition(`${ctx.alias}.first_name`, f, ctx)
	},
	last_name: {
		build: (f, ctx) => textCondition(`${ctx.alias}.last_name`, f, ctx)
	},
	age: {
		build: (f, ctx) =>
			comparison(`EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${ctx.alias}.dob))`, f, ctx)
	},
	date_of_birth: {
		build: (f, ctx) => comparison(`${ctx.alias}.dob`, f, ctx, '::date')
	},
	has_email: {
		build: (f, ctx) => presence(`${ctx.alias}.email`, f)
	},
	has_phone: {
		build: (f, ctx) => presence(`${ctx.alias}.phone`, f)
	}
};

// ---------------------------------------------------------------------------
// Compiler
// ---------------------------------------------------------------------------

/** What a filter or group compiles to: SQL, or a constant when it settles the question by itself. */
type Compiled = string | boolean;

/**
 * SQL for one filter. Inside a NOT group, a condition that cannot be decided
 * (the value it reads is empty) counts as not matching, so that inverting the
 * group includes those records, as "is not" does, instead of dropping them.
 */
function compileFilter(
	filter: Filter,
	entity: FilterEntity,
	ctx: Context,
	negated: boolean
): string {
	// The registry says which kinds of record a filter applies to; the schema has already checked it exists.
	const entry = getFilter(filter.item);
	const name = entry?.name ?? filter.item;
	if (entry && !entry.entities.includes(entity)) {
		throw error(400, `${name} cannot be used to filter ${entity}`);
	}
	const handler = HANDLERS[filter.item];
	if (!handler) throw error(501, `${name} filters are not supported yet`);
	const sql = handler.build(filter, ctx);
	return negated ? `COALESCE((${sql}), false)` : sql;
}

/**
 * Compiles a group. An empty group places no restriction, so it is `true`
 * whether or not it is inverted. Beyond that the usual logic holds: a
 * restriction that always matches drops out of an AND and settles an OR, one
 * that never matches settles an AND and drops out of an OR, and inverting
 * flips a constant.
 */
function compileGroup(
	group: FilterGroup,
	entity: FilterEntity,
	ctx: Context,
	negated: boolean
): Compiled {
	if (group.filters.length === 0) return true;

	const firstParam = ctx.params.length;
	const inverted = negated !== (group.not === true);
	const parts = group.filters.map((entry) =>
		isFilterGroup(entry)
			? compileGroup(entry, entity, ctx, inverted)
			: compileFilter(entry, entity, ctx, inverted)
	);

	// What the group alone decides, before it is inverted. `settles` is the
	// constant that ends it early: false for an AND, true for an OR.
	const settles = group.operator === 'OR';
	let result: Compiled;
	if (parts.includes(settles)) {
		// The branches are discarded, so their parameters must go too: the
		// database rejects a parameter that no placeholder uses.
		ctx.params.length = firstParam;
		result = settles;
	} else {
		const sql = parts.filter((p): p is string => typeof p === 'string');
		if (sql.length === 0) {
			ctx.params.length = firstParam;
			result = !settles;
		} else {
			result = `(${sql.join(group.operator === 'OR' ? ' OR ' : ' AND ')})`;
		}
	}

	if (group.not !== true) return result;
	return typeof result === 'boolean' ? !result : `NOT ${result}`;
}

/** The columns a query may select for each entity type. */
export const FILTER_COLUMNS = {
	locations: [
		'id',
		'source',
		'entity_id',
		'name',
		'address_line_1',
		'address_line_2',
		'address_line_3',
		'city',
		'state_or_region',
		'postal_code',
		'country_code',
		'coordinates',
		'photo_keys'
	],
	people: ['id', 'source', 'first_name', 'last_name', 'email', 'phone', 'dob']
} as const satisfies Record<FilterEntity, readonly string[]>;

export interface BuildFilterOptions {
	/** Columns of the entity view to select. Defaults to `id` and `source`. */
	columns?: readonly string[];
}

/**
 * Validates a filter document from the editor and compiles it to a SQL query
 * for the given entity type. The query is returned, not run: execute it with
 * `client.query(sql, params)` inside `withOrgTransaction`, since the views
 * scope the organization's records through `app.current_org_id`.
 *
 * An empty document matches every record of the type. Throws a 400 for an
 * invalid or incomplete document or a filter that does not apply to the entity
 * type, and a 501 for a filter that is not compiled yet.
 *
 * TODO: Add a step to check permissions to determine the user making the
 * request has the rights to access the data they are requesting.
 */
export function buildFilterQuery(
	entity: FilterEntity,
	document: unknown,
	{ columns = ['id', 'source'] }: BuildFilterOptions = {}
): FilterQuery {
	const parsed = filterGroupSchema.safeParse(document);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		throw error(400, issue?.message ?? 'The filter is not valid');
	}

	// Columns are written in code, never taken from a request; this guards against a typo.
	const allowed: readonly string[] = FILTER_COLUMNS[entity];
	const unknown = columns.filter((c) => !allowed.includes(c));
	if (unknown.length > 0) throw new Error(`Unknown ${entity} columns: ${unknown.join(', ')}`);

	const params: unknown[] = [];
	const { from, alias } = ENTITY_VIEWS[entity];
	const ctx: Context = { alias, params, param: (value) => `$${params.push(value)}` };

	const where = compileGroup(parsed.data, entity, ctx, false);
	const select = columns.map((c) => `${alias}.${c}`).join(', ');
	const clause = where === true ? '' : ` WHERE ${where === false ? 'false' : where}`;

	return { sql: `SELECT ${select} FROM ${from} ${alias}${clause}`, params };
}

// ===========================================================================
// Legacy filters
//
// TEMPORARY: removed with the old filter column (see issue #221).
// ===========================================================================

/**
 * Converts the filters buckets were stored with before the filter editor (a
 * compiled query per kind of record, see `StoredBucketFilter`) into the
 * editor's document (`BucketFilters`).
 *
 * Only filters that `convertBucketFilter` could have written are understood,
 * and anything else is refused rather than guessed, since a wrong guess would
 * quietly change which records a bucket holds.
 */

/** A stored filter that has no faithful equivalent in the editor's model. */
export class LegacyFilterError extends Error {}

/** The expression `convertBucketFilter` writes for a person's age. */
const AGE_COLUMN = 'EXTRACT(YEAR FROM AGE(CURRENT_DATE, vp.dob))';

const TEXT_COLUMNS: Record<FilterEntity, Record<string, string>> = {
	locations: {
		'vl.city': 'city',
		'vl.state_or_region': 'state',
		'vl.postal_code': 'zip_code'
	},
	people: {
		'vp.first_name': 'first_name',
		'vp.last_name': 'last_name'
	}
};

const NUMBER_OPERATIONS: Record<string, FilterOperation> = {
	'=': 'equals',
	'>': 'greater_than',
	'<': 'less_than',
	'>=': 'greater_than_or_equal',
	'<=': 'less_than_or_equal'
};

// "after" and "before" are strict; "not after" and "not before" include the date.
const DATE_OPERATIONS: Record<string, FilterOperation> = {
	'>': 'greater_than',
	'<': 'less_than',
	'<=': 'less_than_or_equal',
	'>=': 'greater_than_or_equal'
};

const refuse = (condition: ConditionNode, why?: string) =>
	new LegacyFilterError(
		`Cannot convert "${condition.column} ${condition.op}"${why ? `: ${why}` : ''}`
	);

/**
 * The text a LIKE pattern matches literally, or null when it contains
 * wildcards or escapes of its own, which the editor's operations cannot say.
 */
function literal(text: string): string | null {
	return /[%_\\]/.test(text) ? null : text;
}

function textFilter(item: string, condition: ConditionNode): Filter {
	const value = typeof condition.value === 'string' ? condition.value : '';

	// The old "is" and "is not" compared exactly, so the new ones must too.
	if (condition.op === '=') return { item, operation: 'equals', value, caseSensitive: true };
	if (condition.op === '!=') return { item, operation: 'not_equals', value, caseSensitive: true };

	if (condition.op === 'ILIKE') {
		const leading = value.startsWith('%');
		const trailing = value.endsWith('%');
		const inner = literal(value.slice(leading ? 1 : 0, value.length - (trailing ? 1 : 0)));

		if (inner === null) throw refuse(condition, 'the text contains % or _');
		if (leading && trailing) return { item, operation: 'contains', value: inner };
		if (trailing) return { item, operation: 'starts_with', value: inner };
	}

	throw refuse(condition);
}

function presenceFilter(item: string, condition: ConditionNode): Filter {
	if (condition.op !== 'IS NOT NULL') throw refuse(condition);
	return { item, operation: 'equals', value: true };
}

function convertCondition(kind: FilterEntity, condition: ConditionNode): Filter {
	if (condition.negate) throw refuse(condition, 'the condition is inverted on its own');

	const text = TEXT_COLUMNS[kind][condition.column];
	if (text) return textFilter(text, condition);

	if (kind === 'people') {
		if (condition.column === AGE_COLUMN) {
			const operation = NUMBER_OPERATIONS[condition.op];
			if (!operation) throw refuse(condition);
			return { item: 'age', operation, value: condition.value };
		}
		if (condition.column === 'vp.dob') {
			const operation = DATE_OPERATIONS[condition.op];
			if (!operation) throw refuse(condition);
			return { item: 'date_of_birth', operation, value: condition.value };
		}
		if (condition.column === 'vp.email') return presenceFilter('has_email', condition);
		if (condition.column === 'vp.phone') return presenceFilter('has_phone', condition);
	}

	throw refuse(condition, `${kind} have no such filter`);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

function convertNode(kind: FilterEntity, node: WhereNode): Filter | FilterGroup {
	// Stored data is only JSON, so nothing about its shape is taken on trust.
	if (!isObject(node)) throw new LegacyFilterError('A condition is not an object');
	if (node.type === 'condition') return convertCondition(kind, node);
	if (node.type === 'group') return convertGroup(kind, node);
	throw new LegacyFilterError(`Cannot convert a "${String((node as { type?: unknown }).type)}" condition`);
}

function convertGroup(kind: FilterEntity, group: GroupNode): FilterGroup {
	if (!Array.isArray(group.children) || (group.connector !== 'AND' && group.connector !== 'OR')) {
		throw new LegacyFilterError('A group of conditions is not in the expected form');
	}
	return {
		operator: group.connector,
		// "None of these" was stored negated, so it converts to an inverted group.
		// Its connector is AND (the old converter only used OR for "one or more"),
		// so it reads "at least one condition below is false", which is what those buckets actually select.
		...(group.negate ? { not: true } : {}),
		filters: group.children.map((child) => convertNode(kind, child))
	};
}

/** One kind of record's stored filter as an editor group, or null when the bucket does not include it. */
function convertEntity(kind: FilterEntity, entity: StoredEntityFilter): FilterGroup | null {
	if (!isObject(entity) || typeof entity.enabled !== 'boolean') {
		throw new LegacyFilterError('The filter is not in the expected form');
	}
	if (!entity.enabled) return null;

	const where = entity.query?.where;
	if (where !== undefined && !isObject(where)) {
		throw new LegacyFilterError('The conditions are not in the expected form');
	}
	const group: FilterGroup = where
		? convertGroup(kind, where)
		: // Included with no conditions: every record of the kind.
			{ operator: 'AND', filters: [] };

	const checked = filterGroupSchema.safeParse(group);
	if (!checked.success) {
		throw new LegacyFilterError(checked.error.issues[0]?.message ?? 'The converted filter is not valid');
	}
	return checked.data;
}

/**
 * Converts a bucket's stored filter. Throws `LegacyFilterError`, naming the
 * kind of record, when some part cannot be converted faithfully.
 */
/**
 * Reads what is stored in a bucket's old `filter` column and converts it. A
 * missing or empty value is a bucket that includes nothing. Anything that is
 * not the old stored format is refused rather than read as empty, since
 * reading it as empty would quietly empty the bucket.
 */
export function convertStoredBucketFilter(stored: unknown): BucketFilters {
	if (stored === null || stored === undefined || (isObject(stored) && Object.keys(stored).length === 0)) {
		return { v: 2, people: null, locations: null };
	}
	if (!isObject(stored) || !('people' in stored) || !('locations' in stored)) {
		const keys = isObject(stored) ? Object.keys(stored).join(', ') : typeof stored;
		throw new LegacyFilterError(`The stored filter is in a form the conversion does not know (${keys})`);
	}
	return convertLegacyBucketFilter(stored as unknown as StoredBucketFilter);
}

export function convertLegacyBucketFilter(legacy: StoredBucketFilter): BucketFilters {
	const convert = (kind: FilterEntity) => {
		try {
			return convertEntity(kind, legacy[kind]);
		} catch (e) {
			if (e instanceof LegacyFilterError) throw new LegacyFilterError(`${kind}: ${e.message}`);
			throw e;
		}
	};

	return { v: 2, people: convert('people'), locations: convert('locations') };
}
