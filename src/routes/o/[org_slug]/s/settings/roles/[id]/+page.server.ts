import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';

export async function load({ params, locals }) {
	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query(
			`SELECT pr.id, pr.name, pr.is_default, pr.weight,
			        COALESCE(
			            array_agg(rp.key ORDER BY rp.key)
			            FILTER (WHERE pre.value = true AND rp.key IS NOT NULL),
			            ARRAY[]::text[]
			        ) AS permissions
			 FROM permission_role pr
			 LEFT JOIN permission_role_entry pre ON pre.role_id = pr.id
			 LEFT JOIN registered_permission rp ON rp.id = pre.registered_permission_id
			 WHERE pr.id = $1 AND pr.organization_id = $2
			 GROUP BY pr.id`,
			[params.id, locals.organization!.id]
		);

		if (result.rowCount === 0) {
			throw error(404, 'Role not found.');
		}

		const row = result.rows[0];
		return { role: { ...row, is_admin: row.weight === 0 } };
	});
}
