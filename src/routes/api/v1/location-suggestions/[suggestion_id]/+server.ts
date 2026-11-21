import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { rejectSuggestion } from '$lib/server/services/suggestions.service';

/**
 * Rejects a volunteer's added location and removes it, with its turf door and
 * anything recorded there. An approved location cannot be removed this way.
 *
 * @auth staff
 * @permission location.delete
 * @returns 204 No Content. 400 for an invalid id, 401 when signed out, 403 without `location.delete`, 404 when it is in none of the caller's organizations, 409 when already reviewed
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await rejectSuggestion(userId, parseId(params.suggestion_id, 'suggestion'));

	return new Response(null, { status: 204 });
};
