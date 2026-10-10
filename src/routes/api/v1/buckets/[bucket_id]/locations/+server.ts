import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { requestedPage } from '$lib/server/pagination';
import { listBucketLocations } from '$lib/server/services/buckets.service';

/**
 * The locations a bucket's filter matches, one page at a time, ordered by name. An empty page when the bucket does not include locations.
 *
 * @auth staff
 * @query page {number} - Optional. 1-based page of 100; out-of-range values are clamped to the nearest page
 * @returns `{ items: Array<{ id, name, address_line_1, address_line_2, city, state_or_region, postal_code }>, totalCount, page, pageSize }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the bucket is not in the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const userId = requireUser(locals);
	const id = parseId(params.bucket_id, 'bucket');

	return json(await listBucketLocations(userId, id, requestedPage(url)));
};
