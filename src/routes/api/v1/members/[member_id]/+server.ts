import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { removeMember } from '$lib/server/services/platform-organizations.service';

/**
 * Removes someone from their organization.
 *
 * @auth infra orgs.manage
 * @returns 204. 400 for an invalid id, 403 without orgs.manage, 404 for an unknown member, 409 for the only owner
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await removeMember(userId, parseId(params.member_id, 'member'));
	return new Response(null, { status: 204 });
};
