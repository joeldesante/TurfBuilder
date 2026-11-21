import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { listListLocations } from '$lib/server/services/turfs.service';

/**
 * Every location on a list with its pin, as the list recorded it, and the
 * latest outcome there on the list's turfs. For the list map and turf cutting.
 *
 * @auth staff
 * @returns `Array<{ record_id, record_source, name, address_line_1, city, state_or_region, postal_code, latitude, longitude, contact_made }>`. 400 for an invalid id or a list of people, 401 when signed out, 403 without staff access, 404 when the list is in none of the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);

	return json(await listListLocations(userId, parseId(params.list_id, 'list')));
};
