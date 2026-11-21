import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { searchOrganization } from '$lib/server/services/search.service';

/**
 * The staff search box: up to five surveys, turfs, members, locations, and
 * people matching `q`, each only when the caller may read that kind.
 *
 * @auth staff
 * @query q {string} - The text; under two characters returns nothing
 * @returns `{ surveys, turfs, members, locations, people }`, each `Array<{ id, title, subtitle, href }>`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the caller is not a member
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const userId = requireUser(locals);
	const id = parseId(params.organization_id, 'organization');

	return json(await searchOrganization(userId, id, url.searchParams.get('q') ?? ''));
};
