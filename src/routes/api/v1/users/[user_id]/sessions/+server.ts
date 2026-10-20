import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { listUserSessions, revokeUserSessions } from '$lib/server/services/platform-users.service';

/**
 * The user's sessions that have not expired, newest first.
 *
 * @auth infra access
 * @returns `UserSession[]`. 400 for an invalid id, 401 when signed out, 403 without infra access, 404 for an unknown user
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	return json(await listUserSessions(userId, parseId(params.user_id, 'user')));
};

/**
 * Signs the user out everywhere. Revoking your own sessions keeps the one making the request.
 *
 * @auth infra users.manage
 * @returns `{ revoked: number }`. 403 without users.manage, 404 for an unknown user
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const targetId = parseId(params.user_id, 'user');
	const keep = targetId === userId ? locals.session?.id : undefined;
	return json({ revoked: await revokeUserSessions(userId, targetId, keep) });
};
