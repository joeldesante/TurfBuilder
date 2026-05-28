import { convertBucketFilter } from './filter-converter';
import type { FilterCondition, MatchType, StoredBucketFilter } from './filter-converter';
import { buildWhereNode, schemaToSqlQuery } from './query-builder';

/**
 * Builds the SQL to retrieve the IDs of records that match the bucket's stored
 * filter for a given entity type.
 *
 * We run this as a separate query (rather than inlining into the snapshot
 * INSERT) so that the bucket's stored column aliases — which may differ from
 * the aliases used in the list snapshot query — are resolved in their own
 * scope and never conflict.
 *
 * Returns null when the bucket has no filter for the given entity type (meaning
 * all records in the view are candidates).
 */
export function buildBucketMatchQuery(
	entityType: 'people' | 'locations',
	bucketFilter: StoredBucketFilter
): { sql: string; params: unknown[] } | null {
	const entityFilter = entityType === 'people' ? bucketFilter.people : bucketFilter.locations;
	if (!entityFilter.enabled || !entityFilter.query) return null;

	// Override the SELECT to only fetch the id column — we just need to know
	// which IDs matched, not the full row.
	const idQuery = { ...entityFilter.query, select: ['id'] };

	try {
		const result = schemaToSqlQuery({ queries: [idQuery] })[0];
		return { sql: result.query, params: result.parameters };
	} catch {
		return null;
	}
}

/**
 * Builds the parameterized INSERT...SELECT SQL that snapshots matching records
 * into universe.list_entry.
 *
 * The bucket's filter is represented as a pre-computed set of IDs
 * (bucketMatchIds). Passing null means "no bucket restriction" — all records
 * visible in the view are eligible.
 *
 * The list's additional filter conditions are applied on top using the view
 * alias (vp / vl), which is always safe here because convertBucketFilter
 * generates conditions with those aliases.
 *
 * @param listId         UUID of the already-inserted universe.list row ($1).
 * @param entityType     Which entity type this list targets.
 * @param bucketMatchIds IDs returned by the bucket filter query, or null.
 * @param listFilter     Additional ad-hoc filter conditions for this list.
 */
export function buildListSnapshotInsert(
	listId: string,
	entityType: 'people' | 'locations',
	bucketMatchIds: string[] | null,
	listFilter: { matchType: MatchType; conditions: FilterCondition[] }
): { sql: string; params: unknown[] } {
	// Convert the list's ad-hoc filter to a WHERE group.
	const listStored = convertBucketFilter({
		people:
			entityType === 'people'
				? { enabled: true, matchType: listFilter.matchType, conditions: listFilter.conditions }
				: { enabled: false, matchType: 'ONE_OR_MORE', conditions: [] },
		locations:
			entityType === 'locations'
				? { enabled: true, matchType: listFilter.matchType, conditions: listFilter.conditions }
				: { enabled: false, matchType: 'ONE_OR_MORE', conditions: [] }
	});
	const listEntityFilter = entityType === 'people' ? listStored.people : listStored.locations;
	const listWhere = listEntityFilter.query?.where;

	const table = entityType === 'people' ? 'universe.v_people vp' : 'universe.v_locations vl';
	const alias = entityType === 'people' ? 'vp' : 'vl';

	// $1 = listId; if bucketMatchIds is provided it becomes $2, and any list
	// filter params are numbered from $3 onward (or $2 if no bucket IDs).
	const params: unknown[] = [listId];
	const whereParts: string[] = [];

	if (bucketMatchIds !== null) {
		params.push(bucketMatchIds);
		whereParts.push(`${alias}.id = ANY($2)`);
	}

	if (listWhere) {
		const clause = buildWhereNode(listWhere, params);
		if (clause) whereParts.push(clause);
	}

	const whereSQL = whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : '';

	const sql = `
		INSERT INTO universe.list_entry (id, list_id, record_id, record_source)
		SELECT gen_random_uuid(), $1, ${alias}.id, ${alias}.source
		FROM ${table}${whereSQL}
	`;

	return { sql, params };
}
