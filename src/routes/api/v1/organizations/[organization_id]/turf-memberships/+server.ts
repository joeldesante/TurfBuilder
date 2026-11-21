import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { joinTurfByCode } from '$lib/server/services/turfs.service';
import { joinTurfSchema } from '$lib/shared/schemas/turfs';

/**
 * Joins the caller to the turf with this code, so it shows on their map.
 * Joining a turf they are already on changes nothing.
 *
 * @auth member
 * @body code {string} - The turf's 6-character join code
 * @returns 201 with `{ id }`, the turf's id. 400 for an invalid id or body, 401 when signed out, 404 for an unknown code or when the caller is not a member
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');
	const { code } = await parseBody(request, joinTurfSchema);

	return json(await joinTurfByCode(userId, orgId, code), { status: 201 });
};
