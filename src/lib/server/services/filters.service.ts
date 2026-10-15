import { error } from '@sveltejs/kit';
import { filterGroupSchema } from '$lib/shared/schemas/filters';
import { getFilter } from '$lib/shared/utils/filter-registry';
import { isFilterGroup } from '$lib/shared/utils/filters';
import type {
	AttemptScope,
	FilterEntity,
	ContactMadeValue,
	Filter,
	FilterGroup,
	RadiusValue
} from '$lib/shared/types/filters';

export type { FilterEntity };

export interface FilterQuery {
	/** Selects the id and source of every record that matches. Parameterized with `$n`. */
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
	/** The entity types this filter can be applied to. */
	entities: FilterEntity[];
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

const HANDLERS: Record<string, Handler> = {
	city: {
		entities: ['locations'],
		build: (f, ctx) => textCondition(`${ctx.alias}.city`, f, ctx)
	},
	state: {
		entities: ['locations'],
		build: (f, ctx) => textCondition(`${ctx.alias}.state_or_region`, f, ctx)
	},
	zip_code: {
		entities: ['locations'],
		build: (f, ctx) => textCondition(`${ctx.alias}.postal_code`, f, ctx)
	},
	radius_from_point: {
		entities: ['locations'],
		build: (f, ctx) => {
			const area = f.value as RadiusValue;
			const point = `ST_SetSRID(ST_MakePoint(${ctx.param(area.longitude)}::float8, ${ctx.param(area.latitude)}::float8), 4326)::geography`;
			const meters = `${ctx.param(area.radius * METERS_PER_MILE)}::float8`;
			return withinOrNot(f, `ST_DWithin(${ctx.alias}.coordinates::geography, ${point}, ${meters})`);
		}
	},
	inside_drawn_region: {
		entities: ['locations'],
		build: (f, ctx) => {
			const region = `ST_SetSRID(ST_GeomFromGeoJSON(${ctx.param(JSON.stringify(f.value))}), 4326)`;
			return withinOrNot(f, `ST_Intersects(${ctx.alias}.coordinates, ${region})`);
		}
	},
	contact_made: {
		entities: ['locations'],
		build: (f, ctx) => {
			if (f.operation !== 'equals') throw unsupported(f);
			return contactMade(f.value as ContactMadeValue, ctx);
		}
	},
	last_canvassed: {
		entities: ['locations'],
		build: (f, ctx) =>
			// A location never canvassed has no date, so every comparison leaves it out.
			comparison(`(${attemptsAt('max(tla.created_at)', ctx)})::date`, f, ctx, '::date')
	},
	first_name: {
		entities: ['people'],
		build: (f, ctx) => textCondition(`${ctx.alias}.first_name`, f, ctx)
	},
	last_name: {
		entities: ['people'],
		build: (f, ctx) => textCondition(`${ctx.alias}.last_name`, f, ctx)
	},
	age: {
		entities: ['people'],
		build: (f, ctx) =>
			comparison(`EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${ctx.alias}.dob))`, f, ctx)
	},
	date_of_birth: {
		entities: ['people'],
		build: (f, ctx) => comparison(`${ctx.alias}.dob`, f, ctx, '::date')
	},
	has_email: {
		entities: ['people'],
		build: (f, ctx) => presence(`${ctx.alias}.email`, f)
	},
	has_phone: {
		entities: ['people'],
		build: (f, ctx) => presence(`${ctx.alias}.phone`, f)
	}
	// Not compiled yet, so they fail loudly instead of matching everything:
	// survey_question_response.
};

// ---------------------------------------------------------------------------
// Compiler
// ---------------------------------------------------------------------------

function compileFilter(filter: Filter, entity: FilterEntity, ctx: Context): string {
	const handler = HANDLERS[filter.item];
	if (!handler) {
		const name = getFilter(filter.item)?.name ?? filter.item;
		throw error(501, `${name} filters are not supported yet`);
	}
	if (!handler.entities.includes(entity)) {
		const name = getFilter(filter.item)?.name ?? filter.item;
		throw error(400, `${name} cannot be used to filter ${entity}`);
	}
	return handler.build(filter, ctx);
}

/**
 * SQL for a group, or null when the group places no restriction. An empty
 * group matches everything, so inside an OR it makes the whole OR match
 * everything, while inside an AND it simply drops out.
 */
function compileGroup(group: FilterGroup, entity: FilterEntity, ctx: Context): string | null {
	const firstParam = ctx.params.length;
	const parts = group.filters.map((entry) =>
		isFilterGroup(entry) ? compileGroup(entry, entity, ctx) : compileFilter(entry, entity, ctx)
	);

	if (group.operator === 'OR') {
		if (parts.length === 0 || parts.includes(null)) {
			// The branches are discarded, so their parameters must go too: the
			// database rejects a parameter that no placeholder uses.
			ctx.params.length = firstParam;
			return null;
		}
		return `(${parts.join(' OR ')})`;
	}

	const restrictions = parts.filter((p): p is string => p !== null);
	return restrictions.length === 0 ? null : `(${restrictions.join(' AND ')})`;
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
export function buildFilterQuery(entity: FilterEntity, document: unknown): FilterQuery {
	const parsed = filterGroupSchema.safeParse(document);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		throw error(400, issue?.message ?? 'The filter is not valid');
	}

	const params: unknown[] = [];
	const { from, alias } = ENTITY_VIEWS[entity];
	const ctx: Context = { alias, params, param: (value) => `$${params.push(value)}` };

	const where = compileGroup(parsed.data, entity, ctx);
	const sql = `SELECT ${alias}.id, ${alias}.source FROM ${from} ${alias}${where ? ` WHERE ${where}` : ''}`;

	return { sql, params };
}
