import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { requestedPage } from '$lib/shared/utils/pagination';
import { listOrgAudit } from '$lib/server/services/platform-organizations.service';

/**
 * Changes infra admins made to the organization, newest first, 25 to a page.
 *
 * @auth infra access
 * @query page {number} - Optional. 1-based
 * @returns `{ items: AuditEntry[], totalCount, page, pageSize }`. 400 for an invalid id, 403 without infra access
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const userId = requireUser(locals);
	return json(await listOrgAudit(userId, parseId(params.organization_id, 'organization'), requestedPage(url)));
};
