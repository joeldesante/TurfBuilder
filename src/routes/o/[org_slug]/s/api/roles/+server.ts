import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

/**
 * Returns all custom roles for the organization, each with their permission set.
 *
 * @auth staff
 * @permission member:read
 * @returns Array of { id, name, is_owner, is_default, permissions: string[] }
 */
export async function GET({ locals }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
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
			 ORDER BY r.is_owner DESC, r.name ASC`,
			[locals.organization.id]
		);
		return json(result.rows);
	} finally {
		client.release();
	}
}

/**
 * Creates a new custom staff role for the organization.
 *
 * @auth owner
 * @body name {string} required - Display name for the new role
 * @returns { id, name, is_owner, is_default }
 */
export async function POST({ request, locals }) {
	if (!locals.organization?.role?.is_owner) {
		return json({ error: 'Only owners can create roles.' }, { status: 403 });
	}

	const { name } = await request.json();
	if (!name?.trim()) {
		return json({ error: 'Name is required.' }, { status: 400 });
	}

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`INSERT INTO org_role (org_id, name, is_default) VALUES ($1, $2, false) RETURNING id, name, is_owner, is_default`,
			[locals.organization.id, name.trim()]
		);
		return json(result.rows[0], { status: 201 });
	} finally {
		client.release();
	}
}
