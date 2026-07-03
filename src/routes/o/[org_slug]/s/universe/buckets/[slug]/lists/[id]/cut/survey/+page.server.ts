import { error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { withOrgTransaction } from '$lib/server/database';

export async function load({ params, locals }) {
	if (!can(locals.organization, 'survey', 'read')) throw error(403, 'Forbidden.');

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const surveys = await client.query(
			`SELECT s.id, s.name, s.description
			 FROM universe.survey s
			 JOIN universe.bucket b ON b.id = s.bucket_id
			 WHERE s.org_id = $1 AND b.slug = $2
			 ORDER BY s.name ASC`,
			[locals.organization!.id, params.slug]
		);

		return { surveys: surveys.rows, bucketSlug: params.slug, listId: params.id };
	});
}
