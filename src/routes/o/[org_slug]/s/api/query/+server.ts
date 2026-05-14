import { json, error } from '@sveltejs/kit';
import { runQueries } from '$lib/server/query-builder';

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
		throw error(400, e instanceof Error ? e.message : 'Query failed');
	}
}
