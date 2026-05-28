import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';

export async function load({ params, locals }) {
	if (!locals.organization) throw error(401, 'Unauthorized');

	return withOrgTransaction(locals.organization.id, async (client) => {
		const bucketResult = await client.query<{ id: string }>(
			`SELECT id FROM universe.bucket WHERE org_id = $1 AND slug = $2`,
			[locals.organization!.id, params.slug]
		);
		if (bucketResult.rows.length === 0) throw error(404, 'Bucket not found');

		const bucketId = bucketResult.rows[0].id;

		const listsResult = await client.query<{
			id: string;
			name: string;
			entity_type: string;
			expires_at: string;
			created_at: string;
			entry_count: number;
		}>(
			`SELECT
				l.id,
				l.name,
				l.entity_type,
				l.expires_at,
				l.created_at,
				COUNT(le.id)::int AS entry_count
			FROM universe.list l
			LEFT JOIN universe.list_entry le ON le.list_id = l.id
			WHERE l.bucket = $1 AND l.org_id = $2
			GROUP BY l.id, l.name, l.entity_type, l.expires_at, l.created_at
			ORDER BY l.created_at DESC`,
			[bucketId, locals.organization!.id]
		);

		return {
			lists: listsResult.rows
		};
	});
}
