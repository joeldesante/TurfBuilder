import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { requestedPage } from '$lib/shared/utils/pagination';
import { listOrgPeople } from '$lib/server/services/people.service';

/**
 * The organization's current people, one page at a time, ordered by last then first name.
 *
 * @auth staff
 * @query page {number} - Optional. 1-based page of 100; out-of-range values are clamped to the nearest page
 * @returns `{ items: Array<{ id, first_name, last_name, email, phone, dob }>, totalCount, page, pageSize }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the caller is not a member
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const userId = requireUser(locals);
	const id = parseId(params.organization_id, 'organization');

	return json(await listOrgPeople(userId, id, requestedPage(url)));
};
