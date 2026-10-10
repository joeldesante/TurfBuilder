import type { PoolClient } from 'pg';
import { schemaToSqlQuery } from './query-builder';
import type { SingleQuery } from './query-builder';

export const BUCKET_PAGE_SIZE = 100;

export interface BucketEntityPage {
	rows: Record<string, unknown>[];
	/** Every row the query matches, not just this page. */
	totalCount: number;
	/** 1-based, clamped to the pages that exist. */
	page: number;
	pageSize: number;
}

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
 * `orderBy` is spliced into the SQL, so it must be a constant written in code
 * (columns of the query's select list), never user input. End it with `id` so
 * the order is total and pages never overlap or skip rows.
 *
 * `requestedPage` is clamped rather than rejected: a stale `?page=` should land
 * on real rows, not an error.
 */
export async function fetchBucketEntityPage(
	client: PoolClient,
	query: SingleQuery,
	{
		requestedPage,
		orderBy,
		pageSize = BUCKET_PAGE_SIZE
	}: { requestedPage: number; orderBy: string; pageSize?: number }
): Promise<BucketEntityPage> {
	const [sql] = schemaToSqlQuery({ queries: [query] });
	// schemaToSqlQuery appends ';', which cannot sit inside a subquery.
	const inner = sql.query.replace(/;$/, '');

	const countResult = await client.query<{ count: string }>(
		`SELECT COUNT(*)::text AS count FROM (${inner}) q`,
		sql.parameters
	);
	const totalCount = parseInt(countResult.rows[0].count, 10);

	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
	const page = Number.isFinite(requestedPage)
		? Math.min(Math.max(Math.trunc(requestedPage), 1), totalPages)
		: 1;

	const n = sql.parameters.length;
	const result = await client.query(
		`SELECT * FROM (${inner}) q ORDER BY ${orderBy} LIMIT $${n + 1} OFFSET $${n + 2}`,
		[...sql.parameters, pageSize, (page - 1) * pageSize]
	);

	return { rows: result.rows, totalCount, page, pageSize };
}
