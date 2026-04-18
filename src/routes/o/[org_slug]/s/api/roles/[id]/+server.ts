import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

/**
 * Renames a custom role. System roles (is_owner = true) cannot be renamed.
 *
 * @auth owner
 * @body name {string} required - New display name for the role
 * @returns { id, name, is_owner, is_default }
 */
export async function PATCH({ params, request, locals }) {
	if (!locals.organization?.role?.is_owner) {
		return json({ error: 'Only owners can edit roles.' }, { status: 403 });
	}

	const { name } = await request.json();
	if (!name?.trim()) {
		return json({ error: 'Name is required.' }, { status: 400 });
	}

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`UPDATE org_role SET name = $1
			 WHERE id = $2 AND org_id = $3 AND is_owner = false
			 RETURNING id, name, is_owner, is_default`,
			[name.trim(), params.id, locals.organization.id]
		);
		if (result.rowCount === 0) {
			return json({ error: 'Role not found or cannot be modified.' }, { status: 404 });
		}
		return json(result.rows[0]);
	} finally {
		client.release();
	}
}

/**
 * Permanently deletes a custom role. System roles and the default role cannot be deleted.
 *
 * @auth owner
 * @returns 204 No Content on success
 */
export async function DELETE({ params, locals }) {
	if (!locals.organization?.role?.is_owner) {
		return json({ error: 'Only owners can delete roles.' }, { status: 403 });
	}

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`DELETE FROM org_role WHERE id = $1 AND org_id = $2 AND is_owner = false AND is_default = false`,
			[params.id, locals.organization.id]
		);
		if (result.rowCount === 0) {
			return json({ error: 'Role not found or cannot be deleted.' }, { status: 404 });
		}
		return new Response(null, { status: 204 });
	} finally {
		client.release();
	}
}
