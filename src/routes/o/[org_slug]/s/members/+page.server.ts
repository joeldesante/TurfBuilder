import { error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { withOrgTransaction } from '$lib/server/database.js';
import { POOL } from '$lib/server/database.js';
import { requestedPage } from '$lib/shared/utils/pagination';
import { queryMembersPage } from '$lib/server/services/members.service';

export async function load({ locals, url }) {
	if (!can(locals.organization, 'member', 'read')) {
		throw error(403, 'Forbidden.');
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const [membersResult, linksResult, slugResult] = await Promise.all([
			queryMembersPage(client, locals.organization!.id, requestedPage(url)),
			POOL.query(
				`SELECT id, created_at, expires_at FROM org_invite_link
				 WHERE org_id = $1 ORDER BY created_at DESC`,
				[locals.organization!.id]
			),
			POOL.query(`SELECT enabled FROM org_slug_invite WHERE org_id = $1`, [
				locals.organization!.id
			])
		]);

		const rolesResult = await client.query(
			`SELECT id, name FROM permission_role
			 WHERE organization_id = $1 AND scope = 'organization'
			 ORDER BY weight ASC`,
			[locals.organization!.id]
		);

		return {
			members: membersResult.items,
			totalCount: membersResult.totalCount,
			page: membersResult.page,
			pageSize: membersResult.pageSize,
			roles: rolesResult.rows,
			canRemoveMembers: can(locals.organization, 'member', 'delete'),
			canManageRoles: can(locals.organization, 'member', 'update'),
			canInvite: can(locals.organization, 'member', 'invite'),
			inviteLinks: linksResult.rows,
			slugInviteEnabled: slugResult.rows[0]?.enabled ?? false
		};
	});
}
