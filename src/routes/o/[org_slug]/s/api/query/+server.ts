import { json, error } from '@sveltejs/kit';
import { runQueries } from '$lib/server/query-builder';
import { logger } from '$lib/server/logger';

export async function POST({ request, locals }) {
	if (!locals.user || !locals.organization?.role) {
		throw error(403, 'Forbidden');
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	try {
		const results = await runQueries(body as never);
		return json({
			results: results.map((r) => ({
				fields: r.fields.map((f) => f.name),
				rows: r.rows
			}))
		});
	} catch (e) {
		// Often the caller's own bad query, so a warning; the message is scrubbed by the serializer.
		logger.warn({ err: e, organizationId: locals.organization?.id }, 'Query endpoint request failed');
		throw error(400, e instanceof Error ? e.message : 'Query failed');
	}
}
