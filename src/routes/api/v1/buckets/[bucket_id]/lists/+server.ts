import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { createBucketList, listBucketLists } from '$lib/server/services/lists.service';
import { filterGroupSchema } from '$lib/shared/schemas/filters';

const postSchema = z.object({
	name: z.string().trim().min(1, 'Name is required'),
	entity_type: z.enum(['people', 'locations']),
	expires_at: z.string().datetime({ message: 'A valid expiration date is required' }),
	filters: filterGroupSchema.optional()
});

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

/**
 * Creates a list: a snapshot of the records the bucket's filters match,
 * narrowed by the list's own filters. The list does not change afterwards.
 *
 * @auth staff
 * @body name {string} - Display name of the list
 * @body entity_type {string} - `people` or `locations`; the bucket must include it
 * @body expires_at {string} - ISO date-time when the list expires
 * @body filters {object} - Optional. A filter group narrowing the bucket's records; leave out for all of them
 * @returns 201 with `{ id }`. 400 for an invalid id or body, a kind of record the bucket does not include, or a filter that cannot run; 401 when signed out; 403 without staff access; 404 when the bucket is not in the caller's organizations; 422 when the bucket's old filter cannot be converted; 501 for a filter that is not supported yet
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const bucketId = parseId(params.bucket_id, 'bucket');

	const body = postSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, body.error.issues[0].message);

	return json(await createBucketList(userId, bucketId, body.data), { status: 201 });
};
