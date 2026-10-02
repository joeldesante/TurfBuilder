import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { listBucketLists } from '$lib/server/services/lists.service';

/**
 * The lists in a bucket, newest first.
 *
 * @auth staff
 * @returns `Array<{ id, name, bucket, entity_type, expires_at, created_at }>`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the bucket is not in the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const bucketId = parseId(params.bucket_id, 'bucket');

	return json(await listBucketLists(userId, bucketId));
};
