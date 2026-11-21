import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { setMemberPermission } from '$lib/server/services/members.service';
import { memberPermissionSchema } from '$lib/shared/schemas/members';

/**
 * Grants or denies one permission to the member, whatever their roles say.
 *
 * @auth member.update
 * @body value {boolean} - true grants, false denies
 * @returns 204. 400 for an invalid id or body, or an unknown permission, 401 when signed out, 403 without `member.update`, 404 when the member is not in the caller's organizations
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const memberId = parseId(params.member_id, 'member');
	const permissionId = parseId(params.permission_id, 'permission');
	const { value } = await parseBody(request, memberPermissionSchema);

	await setMemberPermission(userId, memberId, permissionId, value);
	return new Response(null, { status: 204 });
};

/**
 * Drops the member's override, so their roles decide this permission again.
 *
 * @auth member.update
 * @returns 204, also when there was no override. 400 for an invalid id, 401 when signed out, 403 without `member.update`, 404 when the member is not in the caller's organizations
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const memberId = parseId(params.member_id, 'member');
	const permissionId = parseId(params.permission_id, 'permission');

	await setMemberPermission(userId, memberId, permissionId, null);
	return new Response(null, { status: 204 });
};
