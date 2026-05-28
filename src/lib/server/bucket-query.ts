import type { PoolClient } from 'pg';
import { schemaToSqlQuery } from './query-builder';
import type { SingleQuery } from './query-builder';

/**
 * Runs a stored bucket SingleQuery against the database.
 *
 * Org scoping is handled by the underlying views (universe.v_people,
 * universe.v_locations) which filter org-owned rows using
 * current_setting('app.current_org_id'). This is set automatically by
 * withOrgTransaction, so callers do not need to inject an org condition.
 */
export async function runBucketEntityQuery(
	client: PoolClient,
	query: SingleQuery,
	limit = 500
): Promise<Record<string, unknown>[]> {
	const [sql] = schemaToSqlQuery({ queries: [query] });

	// schemaToSqlQuery appends ';' — strip it before adding LIMIT
	const limitedSql = sql.query.replace(/;$/, '') + ` LIMIT $${sql.parameters.length + 1};`;
	const params = [...sql.parameters, limit];

	const result = await client.query(limitedSql, params);
	return result.rows;
}
