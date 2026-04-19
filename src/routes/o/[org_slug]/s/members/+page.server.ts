import { error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { withOrgTransaction } from '$lib/server/database.js';
import { POOL } from '$lib/server/database.js';

export async function load({ locals }) {
	if (!can(locals.organization, 'member', 'read')) {
		throw error(403, 'Forbidden.');
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const [membersResult, linksResult, slugResult] = await Promise.all([
			client.query(
				// DISTINCT ON picks the lowest-weight (highest-priority) non-default role per user.
				`SELECT DISTINCT ON (u.id) u.id, u.name, u.email, pr.id AS role_id, pr.name AS role_name
				 FROM auth.member m
				 JOIN auth."user" u ON u.id = m.user_id
				 LEFT JOIN user_role_membership urm ON urm.user_id = m.user_id
				 LEFT JOIN permission_role pr
				   ON pr.id = urm.role_id
				   AND pr.organization_id = m.organization_id
				   AND pr.scope = 'organization'
				   AND pr.is_default = false
				 WHERE m.organization_id = $1
				 ORDER BY u.id, pr.weight ASC NULLS LAST`,
				[locals.organization!.id]
			),
			POOL.query(
				`SELECT id, created_at, expires_at FROM org_invite_link
				 WHERE org_id = $1 ORDER BY created_at DESC`,
				[locals.organization!.id]
			),
			POOL.query(`SELECT enabled FROM org_slug_invite WHERE org_id = $1`, [
				locals.organization!.id
			])
		]);

		return {
			members: membersResult.rows,
			canRemoveMembers: can(locals.organization, 'member', 'delete'),
			canInvite: can(locals.organization, 'member', 'invite'),
			inviteLinks: linksResult.rows,
			slugInviteEnabled: slugResult.rows[0]?.enabled ?? false
		};
	});
}
