import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';

export async function load({ locals }) {
	// Same permission the roles API requires to list roles.
	if (!can(locals.organization, 'role', 'read')) throw error(403, 'Forbidden');

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query(`
				SELECT * FROM permission_role
				WHERE organization_id = $1
				ORDER BY weight ASC;
			`,
			[locals.organization!.id]
		);
		return { roles: result.rows };
	});
}
