import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { approveLocationEdit } from '$lib/server/services/suggestions.service';

/**
 * Applies a canvasser's correction as a new version of the location.
 *
 * @auth staff
 * @permission location.update
 * @returns `{ entity_id }`. 400 for an invalid id, 401 when signed out, 403 without `location.update`, 404 when it is in none of the caller's organizations, 409 when already reviewed or the location is gone
 */
export const PUT: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);

	return json(await approveLocationEdit(userId, parseId(params.edit_id, 'correction')));
};
