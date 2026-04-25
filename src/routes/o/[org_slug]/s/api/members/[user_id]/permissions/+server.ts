import { json, error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { withOrgTransaction } from '$lib/server/database';

export async function PUT({ params, request, locals }) {
	if (!can(locals.organization, 'member', 'update')) throw error(403, 'Forbidden.');

	const { permission_id, value }: { permission_id: string; value: boolean | null } =
		await request.json();

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const memberResult = await client.query<{ id: string }>(
			`SELECT id FROM auth.member WHERE user_id = $1 AND organization_id = $2`,
			[params.user_id, locals.organization!.id]
		);
		if (memberResult.rows.length === 0) throw error(404, 'Member not found.');
		const memberId = memberResult.rows[0].id;

		if (value === null) {
			await client.query(
				`DELETE FROM user_permission
				 WHERE member_id = $1 AND registered_permission_id = $2`,
				[memberId, permission_id]
			);
		} else {
			await client.query(
				`INSERT INTO user_permission (user_id, member_id, registered_permission_id, organization_id, value, granted_by)
				 VALUES ($1, $2, $3, $4, $5, $6)
				 ON CONFLICT (member_id, registered_permission_id) WHERE member_id IS NOT NULL
				 DO UPDATE SET value = EXCLUDED.value`,
				[params.user_id, memberId, permission_id, locals.organization!.id, value, locals.user!.id]
			);
		}

		return json({ ok: true });
	});
}
