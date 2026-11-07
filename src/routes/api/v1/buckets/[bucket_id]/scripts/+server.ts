import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { createScript, listBucketScripts } from '$lib/server/services/scripts.service';
import { createScriptSchema } from '$lib/shared/schemas/scripts';

/**
 * The scripts in a bucket, most recently changed first, without their text.
 *
 * @auth staff
 * @returns `Array<{ id, bucket_id, name, updated_at }>`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the bucket is not in the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const bucketId = parseId(params.bucket_id, 'bucket');

	return json(await listBucketScripts(userId, bucketId));
};

/**
 * Creates a script in the bucket.
 *
 * @auth staff
 * @body name {string} - Display name, 1 to 255 characters
 * @body contents {string} - Optional. The script text; empty when omitted
 * @returns 201 with `{ id, bucket_id, name, updated_at, contents }`. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when the bucket is not in the caller's organizations
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const bucketId = parseId(params.bucket_id, 'bucket');
	const body = await parseBody(request, createScriptSchema);

	return json(await createScript(userId, bucketId, body), { status: 201 });
};
