import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { requestedPage } from '$lib/shared/utils/pagination';
import { listListEntries } from '$lib/server/services/lists.service';

/**
 * A list's entries as they were when the list was created, one page at a time. People are ordered by last then first name, locations by city then name.
 *
 * @auth staff
 * @query page {number} - Optional. 1-based page of 100; out-of-range values are clamped to the nearest page
 * @returns `{ items: Array<{ record_id, record_source, entity_id, first_name, last_name, email, phone } for a people list, { record_id, record_source, entity_id, name, address_line_1, city, state_or_region, postal_code } for a locations list>, totalCount, page, pageSize }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the list is not in the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const userId = requireUser(locals);
	const id = parseId(params.list_id, 'list');

	return json(await listListEntries(userId, id, requestedPage(url)));
};
