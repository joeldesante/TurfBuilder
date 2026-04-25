import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers';

export async function PATCH({ params, request, locals }) {
	if (!can(locals.organization, 'member', 'update')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const { role_id }: { role_id: string | null } = await request.json();

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const memberResult = await client.query<{ id: string }>(
			`SELECT id FROM auth.member WHERE user_id = $1 AND organization_id = $2`,
			[params.user_id, locals.organization!.id]
		);
		if (memberResult.rows.length === 0) {
			return json({ error: 'Member not found.' }, { status: 404 });
		}
		const memberId = memberResult.rows[0].id;

		// Check if user currently holds the top-level admin role (weight = 0).
		const currentAdminResult = await client.query<{ count: string }>(
			`SELECT COUNT(*) AS count
			 FROM user_role_membership urm
			 JOIN permission_role pr ON pr.id = urm.role_id
			 WHERE urm.user_id = $1 AND urm.member_id = $2
			   AND pr.organization_id = $3 AND pr.weight = 0`,
			[params.user_id, memberId, locals.organization!.id]
		);
		const isCurrentlyAdmin = parseInt(currentAdminResult.rows[0].count) > 0;

		const newRoleIsAdmin = role_id !== null
			? (await client.query<{ weight: number }>(
				`SELECT weight FROM permission_role WHERE id = $1 AND organization_id = $2`,
				[role_id, locals.organization!.id]
			)).rows[0]?.weight === 0
			: false;

		if (isCurrentlyAdmin && !newRoleIsAdmin) {
			const otherAdminResult = await client.query<{ count: string }>(
				`SELECT COUNT(*) AS count
				 FROM user_role_membership urm
				 JOIN permission_role pr ON pr.id = urm.role_id
				 WHERE pr.organization_id = $1 AND pr.weight = 0 AND urm.user_id != $2`,
				[locals.organization!.id, params.user_id]
			);
			if (parseInt(otherAdminResult.rows[0].count) === 0) {
				return json(
					{ error: 'Cannot remove the last administrator. Assign another administrator first.' },
					{ status: 400 }
				);
			}
		}

		await client.query(
			`DELETE FROM user_role_membership
			 WHERE user_id = $1
			   AND member_id = $2
			   AND role_id IN (
				 SELECT id FROM permission_role
				 WHERE organization_id = $3 AND scope = 'organization'
			   )`,
			[params.user_id, memberId, locals.organization!.id]
		);

		if (role_id !== null) {
			await client.query(
				`INSERT INTO user_role_membership (user_id, member_id, role_id, granted_by)
				 VALUES ($1, $2, $3, $4)
				 ON CONFLICT DO NOTHING`,
				[params.user_id, memberId, role_id, locals.user!.id]
			);
		}

		return json({ ok: true });
	});
}

export async function DELETE({ params, locals }) {
	if (!can(locals.organization, 'member', 'delete')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	if (params.user_id === locals.user?.id) {
		return json({ error: 'You cannot remove yourself from the organization.' }, { status: 400 });
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const memberResult = await client.query<{ id: string }>(
			`SELECT id FROM auth.member WHERE user_id = $1 AND organization_id = $2`,
			[params.user_id, locals.organization!.id]
		);
		if (memberResult.rows.length === 0) {
			return json({ error: 'Member not found.' }, { status: 404 });
		}
		const memberId = memberResult.rows[0].id;

		await client.query(
			`DELETE FROM user_role_membership WHERE user_id = $1 AND member_id = $2`,
			[params.user_id, memberId]
		);
		await client.query(
			`DELETE FROM auth.member WHERE organization_id = $1 AND user_id = $2`,
			[locals.organization!.id, params.user_id]
		);

		return json({ ok: true });
	});
}
