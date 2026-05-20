import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';

export async function load({ params, locals }) {
	if (!locals.organization) throw error(401, 'Unauthorized');

	return withOrgTransaction(locals.organization.id, async (client) => {
		const result = await client.query<{ id: string; name: string; contents: string }>(
			`SELECT id, name, contents FROM universe.script WHERE id = $1 AND org_id = $2 AND bucket = (SELECT id FROM universe.bucket WHERE slug = $3 AND org_id = $2)`,
			[params.id, locals.organization!.id, params.slug]
		);

		if (result.rows.length === 0) throw error(404, 'Script not found');

		return { script: result.rows[0] };
	});
}
