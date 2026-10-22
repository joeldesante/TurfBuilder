import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { listOrgInvitations } from '$lib/server/services/platform-organizations.service';

/**
 * Pending email invitations and open invite links.
 *
 * @auth infra access
 * @returns `{ invitations: OrgInvitation[], links: OrgInviteLink[] }`. 400 for an invalid id, 403 without infra access, 404 for an unknown org
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	return json(await listOrgInvitations(userId, parseId(params.organization_id, 'organization')));
};
