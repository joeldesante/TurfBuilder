import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';

export async function load({ params, locals }) {
	if (!locals.organization?.role?.is_owner) {
		throw error(403, 'Only owners can manage roles.');
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const roleResult = await client.query(
			`SELECT r.id, r.name, r.is_owner, r.is_default,
			        array_agg(rp.resource || ':' || rp.action) FILTER (WHERE rp.id IS NOT NULL) AS permissions
			 FROM org_role r
			 LEFT JOIN org_role_permission rp ON rp.role_id = r.id
			 WHERE r.id = $1 AND r.org_id = $2
			 GROUP BY r.id`,
			[params.id, locals.organization!.id]
		);

		if (roleResult.rowCount === 0) {
			throw error(404, 'Role not found.');
		}

		const membersResult = await client.query(
			`SELECT u.id, u.name, u.email, our.role_id, r.name AS role_name
			 FROM auth.member m
			 JOIN auth.user u ON u.id = m.user_id
			 LEFT JOIN org_user_role our ON our.user_id = u.id AND our.org_id = m.organization_id
			 LEFT JOIN org_role r ON r.id = our.role_id
			 WHERE m.organization_id = $1
			 ORDER BY u.name ASC`,
			[locals.organization!.id]
		);

		return {
			role: roleResult.rows[0],
			members: membersResult.rows
		};
	});
}
