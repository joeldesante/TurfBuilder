import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { requestedPage } from '$lib/shared/utils/pagination';
import { userFiltersFromUrl } from '$lib/shared/schemas/platform-users';
import { listUsers } from '$lib/server/services/platform-users.service';

/**
 * Every user on the instance, one page at a time.
 *
 * @auth infra access
 * @query q {string} - Optional. Matches name, email, or username
 * @query status {'all'|'unverified'|'suspended'|'two_factor'|'infra_admin'|'no_orgs'|'never_active'} - Optional
 * @query sort {'newest'|'oldest'|'recently_active'|'name'} - Optional. Default newest
 * @query page {number} - Optional. 1-based page of 100
 * @returns `{ items: PlatformUserRow[], totalCount, page, pageSize }`. 401 when signed out, 403 without infra access
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const userId = requireUser(locals);
	return json(await listUsers(userId, userFiltersFromUrl(url), requestedPage(url)));
};
