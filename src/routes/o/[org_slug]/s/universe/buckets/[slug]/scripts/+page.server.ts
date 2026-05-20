import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';

export async function load({ params, locals }) {
	if (!locals.organization) throw error(401, 'Unauthorized');

	return withOrgTransaction(locals.organization.id, async (client) => {
		const result = await client.query<{ id: string; name: string; updated_at: string }>(
			`SELECT s.id, s.name, s.updated_at
			 FROM universe.script s
			 JOIN universe.bucket b ON b.id = s.bucket
			 WHERE b.slug = $1 AND s.org_id = $2
			 ORDER BY s.updated_at DESC`,
			[params.slug, locals.organization!.id]
		);

		return { scripts: result.rows };
	});
}
