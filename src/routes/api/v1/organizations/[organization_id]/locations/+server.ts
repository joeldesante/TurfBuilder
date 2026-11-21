import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { requestedPage } from '$lib/shared/utils/pagination';
import { LocationFieldsSchema } from '$lib/schemas/location';
import { createOrgLocation, listOrgLocations } from '$lib/server/services/locations.service';

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

/**
 * Creates a location (a business at a new address), live at once, as staff
 * place one on the admin map.
 *
 * @auth staff
 * @permission location.create
 * @body name, address_line_1, address_line_2, city, state_or_region, postal_code {string|null} - Optional
 * @body country_code {string|null} - Optional. Two letters; the organization's usual country when missing
 * @body latitude, longitude {number} - Required
 * @body photo_keys {string[]} - Optional. Object storage keys, at most 3
 * @returns 201 with `{ entity_id, id }`, the location and its contact version. 400 for an invalid body, 401 when signed out, 403 without `location.create`, 404 when the caller is not a member
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const id = parseId(params.organization_id, 'organization');
	const fields = await parseBody(request, LocationFieldsSchema);

	return json(await createOrgLocation(userId, id, fields), { status: 201 });
};
