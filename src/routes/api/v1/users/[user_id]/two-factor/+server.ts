import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { resetTwoFactor } from '$lib/server/services/platform-users.service';

/**
 * Turns two-factor sign-in off, for someone locked out of their authenticator.
 *
 * @auth infra users.manage
 * @returns 204. 400 for an invalid id, 403 without users.manage, 404 for an unknown user, 409 when it is not on
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await resetTwoFactor(userId, parseId(params.user_id, 'user'));
	return new Response(null, { status: 204 });
};
