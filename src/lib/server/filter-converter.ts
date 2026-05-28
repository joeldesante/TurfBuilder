import { z } from 'zod';
import type { ConditionNode, GroupNode, SingleQuery } from './query-builder';

// ---------------------------------------------------------------------------
// Schema — the raw UI filter state the API receives
// ---------------------------------------------------------------------------

export const FilterConditionSchema = z.object({
	filterId: z.string().min(1),
	qualifierId: z.string().default(''),
	value: z.coerce.string().default(''),
});

export type FilterCondition = z.infer<typeof FilterConditionSchema>;

const MatchTypeSchema = z.enum(['ONE_OR_MORE', 'ALL', 'NONE']);
export type MatchType = z.infer<typeof MatchTypeSchema>;

const EntityFilterInputSchema = z.object({
	enabled: z.boolean(),
	matchType: MatchTypeSchema,
	conditions: z.array(FilterConditionSchema),
});

export const BucketFilterInputSchema = z.object({
	people: EntityFilterInputSchema,
	locations: EntityFilterInputSchema,
});

export type BucketFilterInput = z.infer<typeof BucketFilterInputSchema>;

// ---------------------------------------------------------------------------
// Stored format — what is persisted in universe.bucket.filter (JSONB)
// ---------------------------------------------------------------------------

export interface StoredEntityFilter {
	enabled: boolean;
	query: SingleQuery | null;
}

export interface StoredBucketFilter {
	v: 1;
	people: StoredEntityFilter;
	locations: StoredEntityFilter;
}

// ---------------------------------------------------------------------------
// Column + qualifier mappings
// ---------------------------------------------------------------------------

type BuiltCondition = Pick<ConditionNode, 'column' | 'op' | 'negate' | 'value'>;

function buildTextCondition(column: string, qualifierId: string, value: string): BuiltCondition | null {
	switch (qualifierId) {
		case 'is':
			return { column, op: '=', negate: false, value };
		case 'is_not':
			return { column, op: '!=', negate: false, value };
		case 'contains':
			return { column, op: 'ILIKE', negate: false, value: `%${value}%` };
		case 'starts_with':
			return { column, op: 'ILIKE', negate: false, value: `${value}%` };
		default:
			return null;
	}
}

function buildNumericCondition(column: string, qualifierId: string, value: string): BuiltCondition | null {
	const num = Number(value);
	if (!Number.isFinite(num)) return null;
	switch (qualifierId) {
		case 'eq':
			return { column, op: '=', negate: false, value: num };
		case 'gt':
			return { column, op: '>', negate: false, value: num };
		case 'lt':
			return { column, op: '<', negate: false, value: num };
		case 'gte':
			return { column, op: '>=', negate: false, value: num };
		case 'lte':
			return { column, op: '<=', negate: false, value: num };
		default:
			return null;
	}
}

function buildDateCondition(column: string, qualifierId: string, value: string): BuiltCondition | null {
	if (!value) return null;
	switch (qualifierId) {
		case 'after':
			return { column, op: '>', negate: false, value };
		case 'before':
			return { column, op: '<', negate: false, value };
		case 'not_after':
			return { column, op: '<=', negate: false, value };
		case 'not_before':
			return { column, op: '>=', negate: false, value };
		default:
			return null;
	}
}

// ---------------------------------------------------------------------------
// People filter mapper (table alias: op = universe.org_person)
// ---------------------------------------------------------------------------

function convertPeopleCondition(cond: FilterCondition): BuiltCondition | null {
	const { filterId, qualifierId, value } = cond;

	switch (filterId) {
		case 'first_name':
			return buildTextCondition('vp.first_name', qualifierId, value);
		case 'last_name':
			return buildTextCondition('vp.last_name', qualifierId, value);
		case 'age':
			return buildNumericCondition("EXTRACT(YEAR FROM AGE(CURRENT_DATE, vp.dob))", qualifierId, value);
		case 'dob':
			return buildDateCondition('vp.dob', qualifierId, value);
		case 'has_email':
			return { column: 'vp.email', op: 'IS NOT NULL', negate: false };
		case 'has_phone':
			return { column: 'vp.phone', op: 'IS NOT NULL', negate: false };
		default:
			return null;
	}
}

// ---------------------------------------------------------------------------
// Location filter mapper (table alias: ol = universe.org_location)
// ---------------------------------------------------------------------------

function convertLocationCondition(cond: FilterCondition): BuiltCondition | null {
	const { filterId, qualifierId, value } = cond;

	switch (filterId) {
		case 'city':
			return buildTextCondition('vl.city', qualifierId, value);
		case 'state':
			return buildTextCondition('vl.state_or_region', qualifierId, value);
		case 'zip_code':
			return buildTextCondition('vl.postal_code', qualifierId, value);
		default:
			return null;
	}
}

// ---------------------------------------------------------------------------
// Group builder — converts a list of conditions + matchType into a GroupNode
// ---------------------------------------------------------------------------

function buildGroupNode(
	conditions: BuiltCondition[],
	matchType: MatchType
): GroupNode | undefined {
	if (conditions.length === 0) return undefined;

	const children: ConditionNode[] = conditions.map((c) => ({
		type: 'condition' as const,
		column: c.column,
		op: c.op,
		negate: c.negate,
		...(c.value !== undefined ? { value: c.value } : {}),
	}));

	// NONE = NOT (cond1 OR cond2 OR ...), so connector OR + negate
	const connector: 'AND' | 'OR' =
		matchType === 'ONE_OR_MORE' ? 'OR' : 'AND';
	const negate = matchType === 'NONE';

	return { type: 'group', connector, negate, children };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Converts the raw UI filter input into the stored Queries format.
 * Conditions for fields that are not yet mapped to database columns are
 * silently skipped.
 */
export function convertBucketFilter(input: BucketFilterInput): StoredBucketFilter {
	// People
	let peopleQuery: SingleQuery | null = null;
	if (input.people.enabled) {
		const conditions = input.people.conditions
			.map(convertPeopleCondition)
			.filter((c): c is BuiltCondition => c !== null);

		const where = buildGroupNode(conditions, input.people.matchType);
		peopleQuery = {
			select: ['vp.id', 'vp.first_name', 'vp.last_name', 'vp.email', 'vp.phone', 'vp.dob'],
			from: 'universe.v_people vp',
			...(where ? { where } : {}),
		};
	}

	// Locations
	let locationsQuery: SingleQuery | null = null;
	if (input.locations.enabled) {
		const conditions = input.locations.conditions
			.map(convertLocationCondition)
			.filter((c): c is BuiltCondition => c !== null);

		const where = buildGroupNode(conditions, input.locations.matchType);
		locationsQuery = {
			select: ['vl.id', 'vl.name', 'vl.address_line_1', 'vl.address_line_2', 'vl.city', 'vl.state_or_region', 'vl.postal_code'],
			from: 'universe.v_locations vl',
			...(where ? { where } : {}),
		};
	}

	return {
		v: 1,
		people: { enabled: input.people.enabled, query: peopleQuery },
		locations: { enabled: input.locations.enabled, query: locationsQuery },
	};
}

/**
 * Safely parses a raw JSONB value loaded from universe.bucket.filter.
 * Returns a default (all-disabled) filter when the stored value is missing or
 * from an older schema version that pre-dates the filter column.
 */
export function parseBucketFilter(raw: unknown): StoredBucketFilter {
	const empty: StoredBucketFilter = {
		v: 1,
		people: { enabled: false, query: null },
		locations: { enabled: false, query: null },
	};
	if (!raw || typeof raw !== 'object') return empty;
	const f = raw as Partial<StoredBucketFilter>;
	return {
		v: 1,
		people: f.people ?? empty.people,
		locations: f.locations ?? empty.locations,
	};
}
