import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { LocationPatchSchema } from '$lib/schemas/location';
import { deleteLocation, updateLocation } from '$lib/server/services/locations.service';

/**
 * Changes the given fields of a location as a new version, so the old values
 * stay recoverable. Lists and turfs keep the version they recorded.
 *
 * @auth staff
 * @permission location.update
 * @body Any subset of the location fields (see POST /api/v1/organizations/[organization_id]/locations); omitted keys keep their value, keys sent as null are cleared
 * @returns `{ entity_id, id }`, the location and its new contact version. 400 for an invalid id or body, 401 when signed out, 403 without `location.update`, 404 when it is in none of the caller's organizations or was deleted
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const entityId = parseId(params.entity_id, 'location');
	const patch = await parseBody(request, LocationPatchSchema);

	return json(await updateLocation(userId, entityId, patch));
};

/**
 * Soft-deletes a location. Its history, the lists and turfs it is on, and the
 * canvassing recorded there all stay.
 *
 * @auth staff
 * @permission location.delete
 * @returns 204 No Content. 400 for an invalid id, 401 when signed out, 403 without `location.delete`, 404 when it is in none of the caller's organizations or was already deleted
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await deleteLocation(userId, parseId(params.entity_id, 'location'));

	return new Response(null, { status: 204 });
};
