import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { testStorageConnection } from '$lib/server/services/system-tests.service';

/**
 * Writes and deletes a small probe object, to prove the bucket works with the current settings.
 *
 * @auth infra settings.manage
 * @returns 204. 403 without settings.manage, 409 when storage is not set up, 502 when the bucket cannot be reached
 */
export const POST: RequestHandler = async ({ locals }) => {
	await testStorageConnection(requireUser(locals));
	return new Response(null, { status: 204 });
};
