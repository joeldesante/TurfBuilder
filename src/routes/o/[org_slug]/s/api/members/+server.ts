import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers';

/**
 * Returns all members of the organization with their assigned role info.
 *
 * @auth staff
 * @permission member:read
 * @returns { members: Array<{ id, name, email, role_id, role_name }> }
 */
export async function GET({ locals }) {
	if (!can(locals.organization, 'member', 'read')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`SELECT u.id, u.name, u.email, r.id AS role_id, r.name AS role_name
			 FROM auth.member m
			 JOIN auth."user" u ON u.id = m.user_id
			 LEFT JOIN org_user_role ur ON ur.org_id = m.organization_id AND ur.user_id = m.user_id
			 LEFT JOIN org_role r ON r.id = ur.role_id
			 WHERE m.organization_id = $1
			 ORDER BY u.name ASC`,
			[locals.organization!.id]
		);
		return json({ members: result.rows });
	} finally {
		client.release();
	}
}
