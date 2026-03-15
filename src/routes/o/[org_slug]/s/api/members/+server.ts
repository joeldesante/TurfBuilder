import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers';

// GET returns all org members with their role info.
export async function GET({ locals }) {
	if (!can(locals.organization, 'member', 'read')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`SELECT u.id, u.name, u.email, r.id AS role_id, r.name AS role_name
			 FROM auth.member m
			 JOIN auth."user" u ON u.id = m.user_id
			 LEFT JOIN org_user_role ur ON ur.org_id = m.organization_id AND ur.user_id = m.user_id
			 LEFT JOIN org_role r ON r.id = ur.role_id
			 WHERE m.organization_id = $1
			 ORDER BY u.name ASC`,
			[locals.organization!.id]
		);
		return json({ members: result.rows });
	} finally {
		client.release();
	}
}

// POST adds an existing user to the org by email.
export async function POST({ request, locals }) {
	if (!can(locals.organization, 'member', 'create')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const { email }: { email: string } = await request.json();
	if (!email?.trim()) {
		return json({ error: 'Email is required.' }, { status: 400 });
	}

	const client = await POOL.connect();
	try {
		// Look up user by email.
		const userResult = await client.query(
			`SELECT id FROM auth."user" WHERE email = $1`,
			[email.trim().toLowerCase()]
		);
		if (userResult.rows.length === 0) {
			return json({ error: 'No user found with that email address.' }, { status: 404 });
		}
		const userId = userResult.rows[0].id;

		// Check if already a member.
		const existing = await client.query(
			`SELECT 1 FROM auth.member WHERE organization_id = $1 AND user_id = $2`,
			[locals.organization!.id, userId]
		);
		if (existing.rows.length > 0) {
			return json({ error: 'User is already a member of this organization.' }, { status: 409 });
		}

		await client.query('BEGIN');
		try {
			// Add to auth.member.
			await client.query(
				`INSERT INTO auth.member (user_id, organization_id, role) VALUES ($1, $2, 'member')`,
				[userId, locals.organization!.id]
			);

			// Assign the org's default role if one exists.
			const defaultRole = await client.query(
				`SELECT id FROM org_role WHERE org_id = $1 AND is_default = true LIMIT 1`,
				[locals.organization!.id]
			);
			if (defaultRole.rows.length > 0) {
				await client.query(
					`INSERT INTO org_user_role (org_id, user_id, role_id) VALUES ($1, $2, $3)
					 ON CONFLICT (org_id, user_id) DO NOTHING`,
					[locals.organization!.id, userId, defaultRole.rows[0].id]
				);
			}

			await client.query('COMMIT');
		} catch (err) {
			await client.query('ROLLBACK');
			throw err;
		}

		return json({ ok: true });
	} finally {
		client.release();
	}
}
