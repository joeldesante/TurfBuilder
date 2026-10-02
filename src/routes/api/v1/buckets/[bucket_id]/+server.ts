import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { getBucket, replaceBucket, updateBucket } from '$lib/server/services/buckets.service';

const slugSchema = z
	.string()
	.trim()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens');

const putSchema = z.object({
	name: z.string().trim().min(1),
	slug: slugSchema,
	filter: z.record(z.string(), z.unknown())
});

const patchSchema = putSchema.partial();

/**
 * One bucket.
 *
 * @auth staff
 * @returns The bucket. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const bucketId = parseId(params.bucket_id, 'bucket');

	return json(await getBucket(userId, bucketId));
};

/**
 * Replaces a bucket's name, slug, and filter. All three are required.
 *
 * @auth staff
 * @body name {string} - Display name of the bucket
 * @body slug {string} - URL slug, unique within the organization
 * @body filter {object} - The bucket's filter definition
 * @returns The bucket. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations, 409 for a taken slug
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const bucketId = parseId(params.bucket_id, 'bucket');

	const body = putSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, body.error.issues[0].message);

	return json(await replaceBucket(userId, bucketId, body.data));
};

/**
 * Updates the given fields of a bucket and leaves the rest as they are.
 *
 * @auth staff
 * @body name {string} - Optional. Display name of the bucket
 * @body slug {string} - Optional. URL slug, unique within the organization
 * @body filter {object} - Optional. The bucket's filter definition
 * @returns The bucket. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations, 409 for a taken slug
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const bucketId = parseId(params.bucket_id, 'bucket');

	const body = patchSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, body.error.issues[0].message);

	return json(await updateBucket(userId, bucketId, body.data));
};
