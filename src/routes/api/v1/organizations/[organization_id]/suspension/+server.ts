import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/request';
import { suspendOrgSchema } from '$lib/shared/schemas/platform-organizations';
import { suspendOrg, unsuspendOrg } from '$lib/server/services/platform-organizations.service';

/**
 * Suspends the organization: its members see a suspended page instead of it. Nothing is deleted.
 *
 * @auth infra orgs.manage
 * @body reason {string} - Why, for the audit log
 * @returns 204. 400 for an invalid body, 403 without orgs.manage, 404 for an unknown org, 409 when already suspended or deleted
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');
	const { reason } = await parseBody(request, suspendOrgSchema);
	await suspendOrg(userId, orgId, reason);
	return new Response(null, { status: 204 });
};

/**
 * Lifts the suspension.
 *
 * @auth infra orgs.manage
 * @returns 204. 400 for an invalid id, 403 without orgs.manage, 404 for an unknown org, 409 when not suspended
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await unsuspendOrg(userId, parseId(params.organization_id, 'organization'));
	return new Response(null, { status: 204 });
};
