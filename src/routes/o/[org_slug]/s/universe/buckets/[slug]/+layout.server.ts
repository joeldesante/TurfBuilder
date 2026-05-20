import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';

export async function load({ params, locals }) {
	if (!locals.organization) {
		throw error(401, 'Unauthorized');
	}

	return withOrgTransaction(locals.organization.id, async (client) => {
		const result = await client.query<{ id: string; name: string; slug: string }>(
			`SELECT id, name, slug FROM universe.bucket WHERE org_id = $1 AND slug = $2`,
			[locals.organization!.id, params.slug]
		);

		if (result.rows.length === 0) {
			throw error(404, 'Bucket not found');
		}

		return { bucket: result.rows[0] };
	});
}
