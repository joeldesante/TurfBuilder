import { error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { withOrgTransaction } from '$lib/server/database';

export async function load({ params, locals }) {
	if (!can(locals.organization, 'turf', 'read')) throw error(403, 'Forbidden.');

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query<{
			id: string;
			name: string;
			entity_type: string;
			bucket_id: string;
		}>(
			`SELECT l.id, l.name, l.entity_type, b.id AS bucket_id
			 FROM universe.list l
			 JOIN universe.bucket b ON b.id = l.bucket
			 WHERE l.id = $1 AND l.org_id = $2 AND b.slug = $3`,
			[params.id, locals.organization!.id, params.slug]
		);

		if (result.rows.length === 0) throw error(404, 'List not found');

		const list = result.rows[0];
		if (list.entity_type !== 'locations') {
			throw error(400, 'Map view is only available for location lists');
		}

		return {
			listId: list.id,
			listName: list.name,
			bucketSlug: params.slug
		};
	});
}
