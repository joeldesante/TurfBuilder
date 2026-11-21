import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { approveSuggestion } from '$lib/server/services/suggestions.service';

/**
 * Approves a volunteer's added location: it joins buckets and future lists.
 * Lists made already are snapshots and do not gain it.
 *
 * @auth staff
 * @permission location.create
 * @returns `{ entity_id }`. 400 for an invalid id, 401 when signed out, 403 without `location.create`, 404 when it is in none of the caller's organizations, 409 when already reviewed
 */
export const PUT: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);

	return json(await approveSuggestion(userId, parseId(params.suggestion_id, 'suggestion')));
};
