import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { getUniverseStats } from '$lib/server/services/insights.service';

/**
 * How many people and locations the organization has now.
 *
 * @auth staff
 * @returns `{ people: number, locations: number }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the caller is not a member
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const id = parseId(params.organization_id, 'organization');

	return json(await getUniverseStats(userId, id));
};
