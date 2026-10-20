import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { requestedPage } from '$lib/shared/utils/pagination';
import { listUserActivity } from '$lib/server/services/platform-users.service';

/**
 * What the user has done, newest first, 25 to a page.
 *
 * @auth infra access
 * @query page {number} - Optional. 1-based
 * @returns `{ items: ActivityEntry[], totalCount, page, pageSize }`. 400 for an invalid id, 403 without infra access
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const userId = requireUser(locals);
	return json(await listUserActivity(userId, parseId(params.user_id, 'user'), requestedPage(url)));
};
