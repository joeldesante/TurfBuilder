import { error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers.js';
import { withOrgTransaction } from '$lib/server/database.js';

export async function load({ locals }) {
	if (!can(locals.organization, 'location', 'create')) throw error(403, 'Forbidden.');

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query(
			`SELECT COUNT(*)::int AS count FROM org_location WHERE organization_id = $1`,
			[locals.organization!.id]
		);
		return { count: result.rows[0].count as number };
	});
}
