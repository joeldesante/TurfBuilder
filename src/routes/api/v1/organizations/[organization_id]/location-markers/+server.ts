import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { error } from '@sveltejs/kit';
import { listLocationsInViewport, ViewportSchema } from '$lib/server/services/locations.service';

/**
 * The organization's current locations inside a map viewport, for the admin
 * map. Separate from the paginated collection, which is one alphabetical page
 * and so cannot say what is on screen. A viewport across the antimeridian
 * (west greater than east) is read as two boxes.
 *
 * @auth staff
 * @query west, south, east, north {number} - Required. Viewport corners in degrees
 * @returns `{ locations: Array<like GET .../locations items>, truncated: boolean }`, at most 2000 locations; `truncated` when there were more. 400 for an invalid id or viewport, 401 when signed out, 403 without `location.read`, 404 when the caller is not a member
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const userId = requireUser(locals);
	const id = parseId(params.organization_id, 'organization');
	const viewport = ViewportSchema.safeParse(Object.fromEntries(url.searchParams));
	if (!viewport.success) throw error(400, viewport.error.issues[0]?.message ?? 'Invalid viewport');

	return json(await listLocationsInViewport(userId, id, viewport.data));
};
