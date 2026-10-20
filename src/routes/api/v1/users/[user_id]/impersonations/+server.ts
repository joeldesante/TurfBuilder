import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { startImpersonation } from '$lib/server/services/impersonation.service';

/**
 * Signs the caller in as the user for an hour. The response sets the new
 * session cookie; the caller's own session is restored by
 * DELETE /api/v1/impersonations/current.
 *
 * @auth infra users.impersonate
 * @returns `{ userId, expiresAt }`. 400 for an invalid id or yourself, 403 without users.impersonate or for an infra admin, 404 for an unknown user, 409 for a deleted account
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	return json(await startImpersonation(userId, parseId(params.user_id, 'user'), request.headers), { status: 201 });
};
