import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { getPhotoUrl } from '$lib/server/services/photos.service';

/**
 * Shows a stored location photo by redirecting to a short-lived presigned
 * link. The key is the one the upload answered (`orgs/{org id}/locations/...`).
 *
 * @auth org member
 * @returns 302 to the presigned link. 401 when signed out, 404 when the key is not a location photo in one of the caller's orgs, 503 when object storage is not set up
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);

	throw redirect(302, await getPhotoUrl(userId, params.key));
};
