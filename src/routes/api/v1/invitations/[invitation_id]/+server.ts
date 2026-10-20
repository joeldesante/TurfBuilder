import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { cancelInvitation } from '$lib/server/services/platform-organizations.service';

/**
 * Cancels a pending email invitation.
 *
 * @auth infra orgs.manage
 * @returns 204. 400 for an invalid id, 403 without orgs.manage, 404 when there is no pending invitation with that id
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await cancelInvitation(userId, parseId(params.invitation_id, 'invitation'));
	return new Response(null, { status: 204 });
};
