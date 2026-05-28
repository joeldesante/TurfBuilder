import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { parseBucketFilter } from '$lib/server/filter-converter';

export async function load({ params, locals }) {
	if (!locals.organization) {
		throw error(401, 'Unauthorized');
	}

	return withOrgTransaction(locals.organization.id, async (client) => {
		const result = await client.query<{ id: string; name: string; slug: string; filter: unknown }>(
			`SELECT id, name, slug, filter FROM universe.bucket WHERE org_id = $1 AND slug = $2`,
			[locals.organization!.id, params.slug]
		);

		if (result.rows.length === 0) {
			throw error(404, 'Bucket not found');
		}

		const row = result.rows[0];
		return {
			bucket: {
				id: row.id,
				name: row.name,
				slug: row.slug,
				filter: parseBucketFilter(row.filter),
			}
		};
	});
}
