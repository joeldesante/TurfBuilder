import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { LocationFieldsSchema } from '$lib/schemas/location';
import { suggestLocation } from '$lib/server/services/canvass.service';

/**
 * Adds a location a volunteer found in the field that was not on the turf. It
 * goes onto the turf at once, so they can knock it now, but it is tentative:
 * it stays out of buckets, lists, and future turfs until staff approve it.
 *
 * @auth turf member, while the turf is open
 * @body Location fields (see POST /api/v1/organizations/[organization_id]/locations); the pin must be inside the turf
 * @returns 201 with `{ turf_location_id, entity_id }`. 400 for an invalid id or body, 401 when signed out, 403 when the turf is closed or the caller is not on it, 404 when it is in none of the caller's organizations, 422 for a pin outside the turf, 429 with 25 additions awaiting review
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const turfId = parseId(params.turf_id, 'turf');
	const fields = await parseBody(request, LocationFieldsSchema);

	return json(await suggestLocation(userId, turfId, fields), { status: 201 });
};
