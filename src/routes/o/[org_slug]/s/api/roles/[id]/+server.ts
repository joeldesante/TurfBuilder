import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';

/**
 * Renames a role. The default (Everyone) role cannot be renamed.
 *
 * @auth role.update
 * @body name {string} required - New display name for the role
 * @returns { id, name, is_default }
 */
export async function PATCH({ params, request, locals }) {
	if (!can(locals.organization, 'role', 'update')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const { name } = await request.json();
	if (!name?.trim()) {
		return json({ error: 'Name is required.' }, { status: 400 });
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query(
			`UPDATE permission_role SET name = $1
			 WHERE id = $2 AND organization_id = $3 AND is_default = false
			 RETURNING id, name, is_default`,
			[name.trim(), params.id, locals.organization!.id]
		);
		if (result.rowCount === 0) {
			return json({ error: 'Role not found or cannot be modified.' }, { status: 404 });
		}
		return json(result.rows[0]);
	});
}

/**
 * Permanently deletes a role. The default (Everyone) role cannot be deleted.
 *
 * @auth role.delete
 * @returns 204 No Content on success
 */
export async function DELETE({ params, locals }) {
	if (!can(locals.organization, 'role', 'delete')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query(
			`DELETE FROM permission_role
			 WHERE id = $1 AND organization_id = $2 AND is_default = false`,
			[params.id, locals.organization!.id]
		);
		if (result.rowCount === 0) {
			return json({ error: 'Role not found or cannot be deleted.' }, { status: 404 });
		}
		return new Response(null, { status: 204 });
	});
}
