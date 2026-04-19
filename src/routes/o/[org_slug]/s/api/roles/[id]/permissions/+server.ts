import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { VALID_PERMISSION_KEYS } from '$lib/permissions-config.js';
import { can } from '$lib/auth-helpers.js';

/**
 * Replaces the full permission set for a role.
 *
 * @auth role.update
 * @body permissions {string[]} required - Full list of resource.action keys to grant
 * @returns { ok: true }
 */
export async function PUT({ params, request, locals }) {
	if (!can(locals.organization, 'role', 'update')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const { permissions }: { permissions: string[] } = await request.json();

	for (const p of permissions) {
		if (!VALID_PERMISSION_KEYS.has(p)) {
			return json({ error: `Invalid permission: ${p}` }, { status: 400 });
		}
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const roleResult = await client.query(
			`SELECT id, weight FROM permission_role WHERE id = $1 AND organization_id = $2`,
			[params.id, locals.organization!.id]
		);
		if (roleResult.rowCount === 0) {
			return json({ error: 'Role not found.' }, { status: 404 });
		}

		// Admin roles (weight = 0) must always retain system.access.
		const isAdmin = roleResult.rows[0].weight === 0;
		const effective = isAdmin && !permissions.includes('system.access')
			? [...permissions, 'system.access']
			: permissions;

		await client.query(
			`DELETE FROM permission_role_entry WHERE role_id = $1`,
			[params.id]
		);

		if (effective.length > 0) {
			await client.query(
				`INSERT INTO permission_role_entry (role_id, registered_permission_id, value)
				 SELECT $1, id, true FROM registered_permission WHERE key = ANY($2::text[])`,
				[params.id, effective]
			);
		}

		return json({ ok: true });
	});
}
