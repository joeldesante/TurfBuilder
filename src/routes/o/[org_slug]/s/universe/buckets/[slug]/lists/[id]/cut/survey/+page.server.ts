import { error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { withOrgTransaction } from '$lib/server/database';

export async function load({ params, locals }) {
	if (!can(locals.organization, 'survey', 'read')) throw error(403, 'Forbidden.');

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const surveys = await client.query(
			`SELECT id, name, description FROM survey
			 WHERE organization_id = $1
			 ORDER BY name ASC`,
			[locals.organization!.id]
		);

		return { surveys: surveys.rows, bucketSlug: params.slug, listId: params.id };
	});
}
