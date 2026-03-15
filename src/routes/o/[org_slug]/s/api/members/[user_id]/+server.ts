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
		// Check if the user currently holds an owner role.
		const currentRoleResult = await client.query(
			`SELECT r.is_owner FROM org_user_role ur
			 JOIN org_role r ON r.id = ur.role_id
			 WHERE ur.org_id = $1 AND ur.user_id = $2`,
			[locals.organization.id, params.user_id]
		);
		const currentlyAdmin = currentRoleResult.rows[0]?.is_owner === true;

		if (currentlyAdmin) {
			// Determine whether the target role is also an owner role.
			let newRoleIsAdmin = false;
			if (role_id !== null) {
				const newRoleResult = await client.query(
					`SELECT is_owner FROM org_role WHERE id = $1 AND org_id = $2`,
					[role_id, locals.organization.id]
				);
				newRoleIsAdmin = newRoleResult.rows[0]?.is_owner === true;
			}

			if (!newRoleIsAdmin) {
				// Block if this is the last Administrator.
				const otherAdminCount = await client.query(
					`SELECT COUNT(*) FROM org_user_role ur
					 JOIN org_role r ON r.id = ur.role_id
					 WHERE ur.org_id = $1 AND r.is_owner = true AND ur.user_id != $2`,
					[locals.organization.id, params.user_id]
				);
				if (parseInt(otherAdminCount.rows[0].count) === 0) {
					return json(
						{ error: 'Cannot reassign the last Administrator. Assign another Administrator first.' },
						{ status: 400 }
					);
				}
			}
		}

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

		// Block removal if this user is the last Administrator.
		// FOR UPDATE locks the rows to prevent a race condition where two concurrent
		// requests both pass this check and both succeed, leaving the org with no admins.
		const adminCheckResult = await client.query(
			`SELECT COUNT(*) FROM org_user_role ur
			 JOIN org_role r ON r.id = ur.role_id
			 WHERE ur.org_id = $1 AND r.is_owner = true AND ur.user_id = $2
			 FOR UPDATE`,
			[locals.organization!.id, params.user_id]
		);
		const userIsAdmin = parseInt(adminCheckResult.rows[0].count) > 0;

		if (userIsAdmin) {
			const otherAdminCount = await client.query(
				`SELECT COUNT(*) FROM org_user_role ur
				 JOIN org_role r ON r.id = ur.role_id
				 WHERE ur.org_id = $1 AND r.is_owner = true AND ur.user_id != $2`,
				[locals.organization!.id, params.user_id]
			);
			if (parseInt(otherAdminCount.rows[0].count) === 0) {
				await client.query('ROLLBACK');
				return json(
					{ error: 'Cannot remove the last Administrator from the organization.' },
					{ status: 400 }
				);
			}
		}

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
