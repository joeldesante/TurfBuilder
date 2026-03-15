import { error } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

export async function load({ locals }) {
	if (!locals.organization?.role?.is_owner) {
		throw error(403, 'Only owners can manage roles.');
	}

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`SELECT r.id, r.name, r.is_owner, r.is_default,
			        array_agg(rp.resource || ':' || rp.action) FILTER (WHERE rp.id IS NOT NULL) AS permissions
			 FROM org_role r
			 LEFT JOIN org_role_permission rp ON rp.role_id = r.id
			 WHERE r.org_id = $1
			 GROUP BY r.id
			 ORDER BY r.is_owner DESC, COUNT(rp.id) DESC, r.name ASC`,
			[locals.organization.id]
		);
		return { roles: result.rows };
	} finally {
		client.release();
	}
}
