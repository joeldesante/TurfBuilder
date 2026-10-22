import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { requestedPage } from '$lib/shared/utils/pagination';
import { emailLogFiltersFromUrl } from '$lib/shared/schemas/email-log';
import { listEmailLog } from '$lib/server/services/email-log.service';

/**
 * Every email the app tried to send, newest first, 100 to a page.
 *
 * @auth infra settings.manage
 * @query status {string} - Optional: sent, skipped, or failed
 * @query template {string} - Optional template key
 * @query recipient {string} - Optional exact address
 * @query page {number} - Page number, from 1
 * @returns `Page<EmailLogEntry>`. 401 when signed out, 403 without settings.manage
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const userId = requireUser(locals);
	return json(await listEmailLog(userId, emailLogFiltersFromUrl(url), requestedPage(url)));
};
