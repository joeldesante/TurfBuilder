import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { requestedPage } from '$lib/shared/utils/pagination';
import { auditFiltersFromUrl } from '$lib/shared/schemas/audit';
import { listAuditEvents } from '$lib/server/services/audit.service';

/**
 * Every change infrastructure admins have made, newest first, 100 to a page.
 *
 * @auth infra audit.read
 * @query actorId {uuid} - Optional: the admin who made the change
 * @query action {string} - Optional action key, such as `user.suspend`
 * @query targetType {string} - Optional: user, organization, session, setting, email_template, infra_role, or system
 * @query targetId {string} - Optional id of what was changed
 * @query from {date} - Optional first day, YYYY-MM-DD
 * @query to {date} - Optional last day, YYYY-MM-DD
 * @query page {number} - Page number, from 1
 * @returns `Page<AuditEntry>`. 401 when signed out, 403 without audit.read. Malformed filters are ignored
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const userId = requireUser(locals);
	return json(await listAuditEvents(userId, auditFiltersFromUrl(url), requestedPage(url)));
};
