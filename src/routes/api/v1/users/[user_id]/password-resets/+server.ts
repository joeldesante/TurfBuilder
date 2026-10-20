import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { sendPasswordReset } from '$lib/server/services/platform-users.service';

/**
 * Emails the user a link to choose a new password.
 *
 * @auth infra users.manage
 * @returns 202. 400 for an invalid id, 403 without users.manage, 404 for an unknown user, 409 when mail is not set up or the account was deleted
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await sendPasswordReset(userId, parseId(params.user_id, 'user'));
	return new Response(null, { status: 202 });
};
