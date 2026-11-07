import { error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { requestedPage } from '$lib/shared/utils/pagination';
import { listMembers } from '$lib/server/services/members.service';
import { listRoleOptions } from '$lib/server/services/roles.service';
import { listInviteLinks } from '$lib/server/services/invite-links.service';

export async function load({ locals, url }) {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!can(locals.organization, 'member', 'read')) throw error(403, 'Forbidden.');

	const userId = locals.user.id;
	const orgId = locals.organization!.id;
	const canInvite = can(locals.organization, 'member', 'invite');

	const [members, roles, invites] = await Promise.all([
		listMembers(userId, orgId, requestedPage(url)),
		listRoleOptions(userId, orgId),
		// Invite links are only shown to those who can make them.
		canInvite ? listInviteLinks(userId, orgId) : { links: [], slugInviteEnabled: false }
	]);

	return {
		members: members.items,
		totalCount: members.totalCount,
		page: members.page,
		pageSize: members.pageSize,
		roles,
		canRemoveMembers: can(locals.organization, 'member', 'delete'),
		canManageRoles: can(locals.organization, 'member', 'update'),
		canInvite,
		inviteLinks: invites.links,
		slugInviteEnabled: invites.slugInviteEnabled
	};
}
