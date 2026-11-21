import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { getBucketMapViewport } from '$lib/server/services/buckets.service';
import { bucketMapViewportSchema } from '$lib/shared/schemas/bucket-map';

/**
 * What the bucket map draws for one viewport. Up to 2000 located matches come back as single points; a fuller viewport comes back as counted bubbles on a grid sized to the zoom (about 60 pixels a cell), with any cell holding one location still a point. A viewport across the antimeridian (west greater than east) is read as two boxes.
 *
 * @auth staff
 * @query west, south, east, north {number} - Required. Viewport corners in degrees
 * @query zoom {number} - Required. The map's zoom, 0 to 24
 * @returns `{ points: Array<{ id, name, address_line_1, city, latitude, longitude }>, clusters: Array<{ id, latitude, longitude, count }> }`. Both empty when the bucket does not include locations. 400 for an invalid id or viewport, 401 when signed out, 403 without staff access, 404 when the bucket is not in the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const userId = requireUser(locals);
	const id = parseId(params.bucket_id, 'bucket');
	const viewport = bucketMapViewportSchema.safeParse(Object.fromEntries(url.searchParams));
	if (!viewport.success) throw error(400, viewport.error.issues[0]?.message ?? 'Invalid viewport');

	return json(await getBucketMapViewport(userId, id, viewport.data));
};
