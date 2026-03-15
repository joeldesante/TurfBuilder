import { error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { POOL } from '$lib/server/database.js';

export async function load({ locals }) {
	if (!can(locals.organization, 'member', 'read')) {
		throw error(403, 'Forbidden.');
	}

	const client = await POOL.connect();
	try {
		const [membersResult, linksResult, slugResult] = await Promise.all([
			client.query(
				`SELECT u.id, u.name, u.email, r.id AS role_id, r.name AS role_name
				 FROM auth.member m
				 JOIN auth."user" u ON u.id = m.user_id
				 LEFT JOIN org_user_role ur ON ur.org_id = m.organization_id AND ur.user_id = m.user_id
				 LEFT JOIN org_role r ON r.id = ur.role_id
				 WHERE m.organization_id = $1
				 ORDER BY u.name ASC`,
				[locals.organization!.id]
			),
			client.query(
				`SELECT id, created_at, expires_at FROM org_invite_link
				 WHERE org_id = $1 ORDER BY created_at DESC`,
				[locals.organization!.id]
			),
			client.query(`SELECT enabled FROM org_slug_invite WHERE org_id = $1`, [
				locals.organization!.id
			])
		]);

		return {
			members: membersResult.rows,
			canAddMembers: can(locals.organization, 'member', 'create'),
			canRemoveMembers: can(locals.organization, 'member', 'delete'),
			isOwner: locals.organization!.role?.is_owner ?? false,
			inviteLinks: linksResult.rows,
			slugInviteEnabled: slugResult.rows[0]?.enabled ?? false
		};
	} finally {
		client.release();
	}
}
