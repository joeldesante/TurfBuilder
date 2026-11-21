import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { LocationPatchSchema } from '$lib/schemas/location';
import {
	updateSuggestedLocation,
	withdrawSuggestedLocation
} from '$lib/server/services/canvass.service';

/**
 * Corrects a location the caller added to the turf, while it is still
 * awaiting review and the turf is open. The turf's door follows the correction.
 *
 * @auth the volunteer who added it
 * @body Any subset of the location fields
 * @returns `{ entity_id, id }`. 400 for an invalid id or body, 401 when signed out, 403 once reviewed, when the turf has closed, or for someone else's addition, 404 when the turf is in none of the caller's organizations, 422 for a pin moved outside the turf
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const turfId = parseId(params.turf_id, 'turf');
	const entityId = parseId(params.entity_id, 'location');
	const patch = await parseBody(request, LocationPatchSchema);

	return json(await updateSuggestedLocation(userId, turfId, entityId, patch));
};

/**
 * Withdraws a location the caller added by mistake, with its door and
 * anything recorded there, under the same conditions as correcting it.
 *
 * @auth the volunteer who added it
 * @returns 204 No Content. 400 for an invalid id, 401 when signed out, 403 once reviewed, when the turf has closed, or for someone else's addition, 404 when the turf is in none of the caller's organizations
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await withdrawSuggestedLocation(
		userId,
		parseId(params.turf_id, 'turf'),
		parseId(params.entity_id, 'location')
	);

	return new Response(null, { status: 204 });
};
