import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';

/**
 * Returns all roles for the organization, each with their permission set.
 *
 * @auth role.read
 * @returns Array of { id, name, is_default, permissions: string[] }
 */
export async function GET({ locals }) {
	if (!can(locals.organization, 'role', 'read')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query(
			`SELECT pr.id, pr.name, pr.is_default,
			        COALESCE(
			            array_agg(rp.key ORDER BY rp.key)
			            FILTER (WHERE pre.value = true AND rp.key IS NOT NULL),
			            ARRAY[]::text[]
			        ) AS permissions
			 FROM permission_role pr
			 LEFT JOIN permission_role_entry pre ON pre.role_id = pr.id
			 LEFT JOIN registered_permission rp ON rp.id = pre.registered_permission_id
			 WHERE pr.organization_id = $1
			 GROUP BY pr.id
			 ORDER BY pr.weight ASC`,
			[locals.organization!.id]
		);
		return json(result.rows);
	});
}

/**
 * Creates a new role for the organization.
 *
 * @auth role.create
 * @body name {string} required - Display name for the new role
 * @body weight {number} optional - Priority weight (lower = higher priority)
 * @returns { id, name, is_default }
 */
export async function POST({ request, locals }) {
	if (!can(locals.organization, 'role', 'create')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const { name, weight } = await request.json();
	if (!name?.trim()) {
		return json({ error: 'Name is required.' }, { status: 400 });
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query(
			`INSERT INTO permission_role (name, weight, scope, organization_id, is_default)
			 VALUES ($1, $2, 'organization', $3, false)
			 RETURNING id, name, is_default`,
			[name.trim(), weight ?? 500, locals.organization!.id]
		);
		return json(result.rows[0], { status: 201 });
	});
}
