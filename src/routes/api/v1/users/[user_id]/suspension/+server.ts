import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/request';
import { suspendUserSchema } from '$lib/shared/schemas/platform-users';
import { suspendUser, unsuspendUser } from '$lib/server/services/platform-users.service';

/**
 * Suspends the user: they are signed out now and cannot sign in until it ends.
 *
 * @auth infra users.manage
 * @body reason {string} - Shown to the user when they try to sign in
 * @body expiresAt {string|null} - Optional. ISO date-time it ends; none means until lifted
 * @returns `PlatformUserDetail`. 400 for an invalid body or yourself, 403 without users.manage, 404 for an unknown user, 409 for an infra admin or a deleted account
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const targetId = parseId(params.user_id, 'user');
	return json(await suspendUser(userId, targetId, await parseBody(request, suspendUserSchema)));
};

/**
 * Lifts the suspension.
 *
 * @auth infra users.manage
 * @returns `PlatformUserDetail`. 400 for an invalid id, 403 without users.manage, 404 for an unknown user, 409 when not suspended
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	return json(await unsuspendUser(userId, parseId(params.user_id, 'user')));
};
