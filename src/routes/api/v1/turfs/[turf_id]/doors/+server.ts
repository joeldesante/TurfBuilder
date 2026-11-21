import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { listDoorStatuses } from '$lib/server/services/canvass.service';

/**
 * Whether each door on the turf has been visited, and the latest outcome, for
 * the canvasser's map.
 *
 * @auth turf member
 * @returns `Array<{ id, visited: boolean, contact_made: boolean | null }>`. 400 for an invalid id, 401 when signed out, 403 unless the caller joined the turf, 404 when it is in none of the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);

	return json(await listDoorStatuses(userId, parseId(params.turf_id, 'turf')));
};
