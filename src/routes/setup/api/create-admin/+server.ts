import { json, error } from '@sveltejs/kit';
import { getAuth } from '$lib/auth';
import { POOL } from '$lib/server/database';
import { markSetupComplete } from '$lib/server/setup';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url }) => {
	const { name, username, email, password } = await request.json();

	if (!name || !username || !email || !password) {
		throw error(400, 'All fields are required');
	}

	// Create the user via better-auth so password hashing is handled correctly.
	const auth = await getAuth();
	let userId: string;
	try {
		const result = await auth.api.signUpEmail({
			body: { name, username, email, password },
			headers: new Headers({ origin: url.origin, 'content-type': 'application/json' })
		});
		if (!result?.user?.id) throw new Error('No user returned from signUpEmail');
		userId = result.user.id;
	} catch (e) {
		throw error(500, `Failed to create user: ${String(e)}`);
	}

	// Grant all infrastructure permissions directly to the admin user.
	// An infra role is created (or reused) and the user is assigned to it.
	const client = await POOL.connect();
	try {
		await client.query('BEGIN');

		// Upsert an "Infrastructure Administrator" role.
		const roleRes = await client.query<{ id: string }>(
			`INSERT INTO permission_role (name, weight, scope, organization_id, is_default)
			 VALUES ('Infrastructure Administrator', 0, 'infrastructure', NULL, false)
			 ON CONFLICT DO NOTHING
			 RETURNING id`
		);

		let infraRoleId: string;
		if (roleRes.rows.length > 0) {
			infraRoleId = roleRes.rows[0].id;

			// Grant all infrastructure permissions to this role.
			await client.query(
				`INSERT INTO permission_role_entry (role_id, registered_permission_id, value)
				 SELECT $1, id, true FROM registered_permission WHERE scope = 'infrastructure'
				 ON CONFLICT DO NOTHING`,
				[infraRoleId]
			);
		} else {
			// Role already exists — look it up.
			const existing = await client.query<{ id: string }>(
				`SELECT id FROM permission_role
				 WHERE scope = 'infrastructure' AND name = 'Infrastructure Administrator'
				 LIMIT 1`
			);
			if (existing.rows.length === 0) throw new Error('Could not find or create infra role');
			infraRoleId = existing.rows[0].id;
		}

		// Assign the admin user to the infra role (member_id must be NULL for infra).
		await client.query(
			`INSERT INTO user_role_membership (user_id, member_id, role_id, granted_by)
			 VALUES ($1, NULL, $2, $1)
			 ON CONFLICT DO NOTHING`,
			[userId, infraRoleId]
		);

		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw error(500, `Failed to assign infrastructure permissions: ${String(e)}`);
	} finally {
		client.release();
	}

	markSetupComplete();

	return json({ ok: true });
};
