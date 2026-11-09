import { error, isHttpError, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { QueryError, runQueries } from '$lib/server/services/query-builder.service';
import { logger } from '$lib/server/logger';

/**
 * Runs Quick Search queries: plain selects of named columns from the tables
 * the query builder allows, for infra admins.
 *
 * @auth infra admin
 * @body queries {Array<{ select: string[], from: string, ... }>} - Required
 * @returns `{ results: Array<{ fields: string[], rows: object[] }> }`. 400 for a query the builder refuses or that fails, 401 when signed out, 403 for anyone else
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const userId = requireUser(locals);
	const body = await request.json().catch(() => null);
	if (body === null) throw error(400, 'Invalid JSON');

	try {
		const results = await runQueries(userId, body as never);
		return json({
			results: results.map((r) => ({ fields: r.fields.map((f) => f.name), rows: r.rows }))
		});
	} catch (e) {
		if (e instanceof QueryError) throw error(400, e.message);
		if (isHttpError(e)) throw e;
		// Often the caller's own bad query, so a warning; the message is scrubbed by the serializer.
		logger.warn({ err: e }, 'Query endpoint request failed');
		throw error(400, e instanceof Error ? e.message : 'Query failed');
	}
};
