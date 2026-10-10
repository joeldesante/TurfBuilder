import type { PoolClient } from 'pg';
import { schemaToSqlQuery } from './query-builder';
import type { SingleQuery } from './query-builder';
import { clampPage, pageOffset, PAGE_SIZE } from './pagination';
import type { Page } from './pagination';

/**
 * Sort orders for a bucket's entities. They end in `id` so the order is total
 * and pages never overlap or skip rows. They name columns of the bucket query's
 * select list (see `convertBucketFilter`).
 */
export const BUCKET_LOCATION_ORDER = 'name NULLS LAST, address_line_1 NULLS LAST, id';
export const BUCKET_PEOPLE_ORDER = 'last_name NULLS LAST, first_name NULLS LAST, id';

/**
 * Runs a stored bucket SingleQuery and returns one page of its rows with the
 * total. A bucket can match far more rows than fit in memory on the server or
 * in the browser, so callers always get a page, never the whole result.
 *
 * Org scoping is handled by the underlying views (universe.v_people,
 * universe.v_locations) which filter org-owned rows using
 * current_setting('app.current_org_id'). This is set automatically by
 * withOrgTransaction, so callers do not need to inject an org condition.
 *
 * `orderBy` is spliced into the SQL, so it must be a constant written in code,
 * such as `BUCKET_LOCATION_ORDER`, never user input.
 */
export async function fetchBucketEntityPage(
	client: PoolClient,
	query: SingleQuery,
	{
		requestedPage,
		orderBy,
		pageSize = PAGE_SIZE
	}: { requestedPage: number; orderBy: string; pageSize?: number }
): Promise<Page<Record<string, unknown>>> {
	const [sql] = schemaToSqlQuery({ queries: [query] });
	// schemaToSqlQuery appends ';', which cannot sit inside a subquery.
	const inner = sql.query.replace(/;$/, '');

	const countResult = await client.query<{ count: string }>(
		`SELECT COUNT(*)::text AS count FROM (${inner}) q`,
		sql.parameters
	);
	const totalCount = parseInt(countResult.rows[0].count, 10);
	const page = clampPage(requestedPage, totalCount, pageSize);

	const n = sql.parameters.length;
	const result = await client.query(
		`SELECT * FROM (${inner}) q ORDER BY ${orderBy} LIMIT $${n + 1} OFFSET $${n + 2}`,
		[...sql.parameters, pageSize, pageOffset(page, pageSize)]
	);

	return { items: result.rows, totalCount, page, pageSize };
}
