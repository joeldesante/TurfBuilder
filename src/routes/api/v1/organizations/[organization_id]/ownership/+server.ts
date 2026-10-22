import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/request';
import { transferOwnershipSchema } from '$lib/shared/schemas/platform-organizations';
import { transferOwnership } from '$lib/server/services/platform-organizations.service';

/**
 * Makes a member the owner. They also get the Administrator role; previous owners become admins.
 *
 * @auth infra orgs.manage
 * @body memberId {uuid} - The member to make owner
 * @returns 204. 400 for an invalid body, 403 without orgs.manage, 404 for an unknown org or member, 409 for a deleted org
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');
	const { memberId } = await parseBody(request, transferOwnershipSchema);
	await transferOwnership(userId, orgId, memberId);
	return new Response(null, { status: 204 });
};
