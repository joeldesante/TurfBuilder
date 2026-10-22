import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { listUserMemberships } from '$lib/server/services/platform-users.service';

/**
 * The organizations the user belongs to, with their role and last activity in each.
 *
 * @auth infra access
 * @returns `UserMembership[]`. 400 for an invalid id, 401 when signed out, 403 without infra access
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	return json(await listUserMemberships(userId, parseId(params.user_id, 'user')));
};
