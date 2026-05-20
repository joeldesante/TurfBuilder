import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { z } from 'zod';

const UpdateScriptSchema = z.object({
	contents: z.string()
});

export async function PUT({ params, request, locals }) {
	if (!locals.organization) {
		return json({ error: 'Unauthorized.' }, { status: 401 });
	}

	const body = await request.json();
	const parsed = UpdateScriptSchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 });
	}

	return withOrgTransaction(locals.organization.id, async (client) => {
		const result = await client.query(
			`UPDATE universe.script
			 SET contents = $1, updated_at = now()
			 WHERE id = $2 AND org_id = $3
			 RETURNING id`,
			[parsed.data.contents, params.id, locals.organization!.id]
		);

		if (result.rows.length === 0) {
			return json({ error: 'Script not found.' }, { status: 404 });
		}

		return json({ ok: true });
	});
}
