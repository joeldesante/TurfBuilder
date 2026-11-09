import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { createPhotoUpload, PhotoUploadSchema } from '$lib/server/services/photos.service';

/**
 * Starts a location photo upload: answers a presigned PUT the browser sends
 * the file to, and the key to save on the location (`photo_keys`).
 *
 * @auth org member
 * @body contentType {string} required - image/jpeg, image/webp, or image/png
 * @body contentLength {number} required - Byte size, max 5,000,000
 * @returns 201 with `{ url, key }`. 400 for an invalid body or id, 401 when signed out, 404 when the caller is not a member, 503 when object storage is not set up
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');
	const input = await parseBody(request, PhotoUploadSchema);

	return json(await createPhotoUpload(userId, orgId, input), { status: 201 });
};
