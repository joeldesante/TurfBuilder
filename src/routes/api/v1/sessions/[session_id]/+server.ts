import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { revokeSession } from '$lib/server/services/platform-users.service';

/**
 * Ends one session.
 *
 * @auth infra users.manage
 * @returns 204. 400 for an invalid id, 401 when signed out, 403 without users.manage, 404 for an unknown session
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await revokeSession(userId, parseId(params.session_id, 'session'));
	return new Response(null, { status: 204 });
};
