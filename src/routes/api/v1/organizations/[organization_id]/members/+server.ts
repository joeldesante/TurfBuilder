import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { requestedPage } from '$lib/shared/utils/pagination';
import { listMembers } from '$lib/server/services/members.service';

/**
 * The organization's members, one page at a time, ordered by name, each with their highest-priority role.
 *
 * @auth staff
 * @query page {number} - Optional. 1-based page of 100; out-of-range values are clamped to the nearest page
 * @query q {string} - Optional. Only members whose name or email contains this
 * @returns `{ items: Array<{ id, name, email, role_id, role_name }>, totalCount, page, pageSize }`. 400 for an invalid id, 401 when signed out, 403 without `member.read`, 404 when the caller is not a member
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const userId = requireUser(locals);
	const id = parseId(params.organization_id, 'organization');

	const q = url.searchParams.get('q')?.slice(0, 200) || undefined;

	return json(await listMembers(userId, id, requestedPage(url), q));
};
