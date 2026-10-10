import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { requestedPage } from '$lib/server/pagination';
import { listBucketPeople } from '$lib/server/services/buckets.service';

/**
 * The people a bucket's filter matches, one page at a time, ordered by last then first name. An empty page when the bucket does not include people.
 *
 * @auth staff
 * @query page {number} - Optional. 1-based page of 100; out-of-range values are clamped to the nearest page
 * @returns `{ items: Array<{ id, first_name, last_name, email, phone, dob }>, totalCount, page, pageSize }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the bucket is not in the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const userId = requireUser(locals);
	const id = parseId(params.bucket_id, 'bucket');

	return json(await listBucketPeople(userId, id, requestedPage(url)));
};
