import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { removeMember, setMemberRole } from '$lib/server/services/members.service';
import { updateMemberSchema } from '$lib/shared/schemas/members';

/**
 * Gives the member one organization role in place of the ones they hold.
 *
 * @auth member.update
 * @body role_id {string|null} - The role, or null for only the default role
 * @returns 204. 400 for an invalid id or body, a role from another organization, or when it would leave no administrator, 401 when signed out, 403 without `member.update`, 404 when the member is not in the caller's organizations
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const memberId = parseId(params.member_id, 'member');
	const { role_id } = await parseBody(request, updateMemberSchema);

	await setMemberRole(userId, memberId, role_id);
	return new Response(null, { status: 204 });
};

/**
 * Removes someone from their organization. Staff cannot remove themselves.
 *
 * @auth member.delete, or infra orgs.manage for any organization
 * @returns 204. 400 for an invalid id or when removing yourself, 401 when signed out, 403 without permission, 404 for a member the caller cannot see, 409 for the only owner
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await removeMember(userId, parseId(params.member_id, 'member'));
	return new Response(null, { status: 204 });
};
