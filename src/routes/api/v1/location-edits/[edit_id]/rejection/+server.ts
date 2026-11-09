import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { rejectLocationEdit } from '$lib/server/services/suggestions.service';

/**
 * Declines a canvasser's correction. It is kept, marked rejected.
 *
 * @auth staff
 * @permission location.update
 * @returns 204 No Content. 400 for an invalid id, 401 when signed out, 403 without `location.update`, 404 when it is in none of the caller's organizations, 409 when already reviewed
 */
export const PUT: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await rejectLocationEdit(userId, parseId(params.edit_id, 'correction'));

	return new Response(null, { status: 204 });
};
