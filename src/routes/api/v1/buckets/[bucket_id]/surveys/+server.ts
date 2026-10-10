import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { createSurvey, listBucketSurveys } from '$lib/server/services/surveys.service';

const postSchema = z.object({
	name: z.string().trim().min(1).max(255),
	description: z.string().max(2000).nullable().optional()
});

/**
 * The surveys in a bucket, by name.
 *
 * @auth staff
 * @returns `Array<{ id, bucket_id, name, description }>`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the bucket is not in the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const bucketId = parseId(params.bucket_id, 'bucket');

	return json(await listBucketSurveys(userId, bucketId));
};

/**
 * Creates an empty survey in the bucket. Add questions with
 * `PUT /api/v1/surveys/{survey_id}/questions`.
 *
 * @auth staff
 * @body name {string} - Display name, 1 to 255 characters
 * @body description {string|null} - Optional, at most 2000 characters
 * @returns 201 with the survey. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when the bucket is not in the caller's organizations
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const bucketId = parseId(params.bucket_id, 'bucket');

	const body = postSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, body.error.issues[0].message);

	return json(await createSurvey(userId, bucketId, body.data), { status: 201 });
};
