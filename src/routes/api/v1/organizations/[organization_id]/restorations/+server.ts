import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { restoreOrg } from '$lib/server/services/platform-organizations.service';

/**
 * Restores a deleted organization.
 *
 * @auth infra orgs.manage
 * @returns 204. 400 for an invalid id, 403 without orgs.manage, 404 for an unknown org, 409 when not deleted
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await restoreOrg(userId, parseId(params.organization_id, 'organization'));
	return new Response(null, { status: 204 });
};
