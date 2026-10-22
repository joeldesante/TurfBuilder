import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { revokeInfraRole } from '$lib/server/services/infra-admins.service';

/**
 * Takes an infrastructure role away from the user.
 *
 * @auth infra users.manage
 * @returns 204. 400 for an invalid id, 403 without users.manage, 404 when the user does not have it, 409 when it would leave no admin who can manage users
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await revokeInfraRole(userId, parseId(params.user_id, 'user'), parseId(params.role_id, 'role'));
	return new Response(null, { status: 204 });
};
