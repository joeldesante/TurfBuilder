import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';
import { PERMISSION_RESOURCES, ALL_ACTIONS } from '$lib/permissions-config.js';

const VALID_RESOURCES = new Set(PERMISSION_RESOURCES.map((r) => r.resource));
const VALID_ACTIONS = new Set(ALL_ACTIONS);

// PUT replaces all permissions for a role with the provided list.
export async function PUT({ params, request, locals }) {
	if (!locals.organization?.role?.is_owner) {
		return json({ error: 'Only owners can edit role permissions.' }, { status: 403 });
	}

	const { permissions }: { permissions: string[] } = await request.json();

	// Validate all permission strings before touching the database.
	for (const p of permissions) {
		const [resource, action] = p.split(':');
		if (!VALID_RESOURCES.has(resource) || !VALID_ACTIONS.has(action as never)) {
			return json({ error: `Invalid permission: ${p}` }, { status: 400 });
		}
	}

	const client = await POOL.connect();
	try {
		// Verify role belongs to this org and is not the owner role.
		const roleResult = await client.query(
			`SELECT id, is_owner FROM org_role WHERE id = $1 AND org_id = $2`,
			[params.id, locals.organization.id]
		);
		if (roleResult.rowCount === 0) {
			return json({ error: 'Role not found.' }, { status: 404 });
		}
		if (roleResult.rows[0].is_owner) {
			return json({ error: 'Owner role permissions cannot be modified.' }, { status: 400 });
		}

		await client.query('BEGIN');
		await client.query(`DELETE FROM org_role_permission WHERE role_id = $1`, [params.id]);

		if (permissions.length > 0) {
			// Build parameterized query: ($1,$2,$3), ($1,$4,$5), ...
			const placeholders = permissions
				.map((p, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
				.join(', ');
			const values: string[] = [params.id];
			for (const p of permissions) {
				const [resource, action] = p.split(':');
				values.push(resource, action);
			}
			await client.query(
				`INSERT INTO org_role_permission (role_id, resource, action) VALUES ${placeholders}`,
				values
			);
		}

		await client.query('COMMIT');
		return json({ ok: true });
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	} finally {
		client.release();
	}
}
