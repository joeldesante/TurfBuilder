import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { getTurfPreview } from '$lib/server/services/turfs.service';

/**
 * A turf's outline and doors, as the turf recorded them, with the latest
 * outcome at each, for the map preview.
 *
 * @auth staff
 * @returns `{ turf: { id, code, bounds }, locations: Array<{ id, name, address_line_1, city, state_or_region, latitude, longitude, contact_made }> }`, `bounds` as GeoJSON text. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is in none of the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);

	return json(await getTurfPreview(userId, parseId(params.turf_id, 'turf')));
};
