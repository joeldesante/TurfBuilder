import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { requestedPage } from '$lib/server/pagination';
import { listOrgLocations } from '$lib/server/services/locations.service';

/**
 * The organization's current locations, one page at a time, ordered by name.
 *
 * @auth staff
 * @query page {number} - Optional. 1-based page of 100; out-of-range values are clamped to the nearest page
 * @returns `{ items: Array<{ id, entity_id, name, address_line_1, address_line_2, city, state_or_region, postal_code, country_code, latitude, longitude, photo_keys, suggestion_status }>, totalCount, page, pageSize }`. 400 for an invalid id, 401 when signed out, 403 without `location.read`, 404 when the caller is not a member
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const userId = requireUser(locals);
	const id = parseId(params.organization_id, 'organization');

	return json(await listOrgLocations(userId, id, requestedPage(url)));
};
