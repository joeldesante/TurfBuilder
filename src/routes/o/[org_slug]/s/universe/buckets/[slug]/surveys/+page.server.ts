import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';

export async function load({ locals }) {
	if (!locals.organization) throw error(401, 'Unauthorized');

	return withOrgTransaction(locals.organization.id, async (client) => {
		const result = await client.query<{ id: string; name: string; updated_at: string }>(
			`SELECT id, name, updated_at FROM survey WHERE organization_id = $1 ORDER BY updated_at DESC`,
			[locals.organization!.id]
		);

		return { surveys: result.rows };
	});
}
