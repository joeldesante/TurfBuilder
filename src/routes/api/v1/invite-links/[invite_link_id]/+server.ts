import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { revokeInviteLink } from '$lib/server/services/platform-organizations.service';

/** Invite link ids are generated tokens, not uuids. */
const LINK_ID = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * Closes an invite link so it can no longer be used to join.
 *
 * @auth infra orgs.manage
 * @returns 204. 400 for an invalid id, 403 without orgs.manage, 404 when there is no open link with that id
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	if (!LINK_ID.test(params.invite_link_id)) throw error(400, 'Invalid invite link id');
	await revokeInviteLink(userId, params.invite_link_id);
	return new Response(null, { status: 204 });
};
