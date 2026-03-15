import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers';

// PATCH assigns or removes an org role for a member.
export async function PATCH({ params, request, locals }) {
	if (!locals.organization?.role?.is_owner) {
		return json({ error: 'Only owners can assign roles.' }, { status: 403 });
	}

	const { role_id }: { role_id: string | null } = await request.json();

	const client = await POOL.connect();
	try {
		if (role_id === null) {
			await client.query(
				`DELETE FROM org_user_role WHERE org_id = $1 AND user_id = $2`,
				[locals.organization.id, params.user_id]
			);
		} else {
			await client.query(
				`INSERT INTO org_user_role (org_id, user_id, role_id) VALUES ($1, $2, $3)
				 ON CONFLICT (org_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id`,
				[locals.organization.id, params.user_id, role_id]
			);
		}
		return json({ ok: true });
	} finally {
		client.release();
	}
}

// DELETE removes a member from the org.
export async function DELETE({ params, locals }) {
	if (!can(locals.organization, 'member', 'delete')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	// Prevent removing yourself.
	if (params.user_id === locals.user?.id) {
		return json({ error: 'You cannot remove yourself from the organization.' }, { status: 400 });
	}

	const client = await POOL.connect();
	try {
		await client.query('BEGIN');
		// Remove custom role assignment.
		await client.query(
			`DELETE FROM org_user_role WHERE org_id = $1 AND user_id = $2`,
			[locals.organization!.id, params.user_id]
		);
		// Remove from org membership.
		await client.query(
			`DELETE FROM auth.member WHERE organization_id = $1 AND user_id = $2`,
			[locals.organization!.id, params.user_id]
		);
		await client.query('COMMIT');
		return json({ ok: true });
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	} finally {
		client.release();
	}
}
