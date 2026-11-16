import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { listContactImportJobs } from '$lib/server/services/contact-import-jobs.service';

/**
 * The organization's contact import jobs, running and waiting ones first, then the newest. At most 100.
 *
 * @auth org staff (system.access)
 * @returns `Array<{ id, file_id, file_name, status, rows_total, rows_processed, rows_skipped, error, created_at, started_at, updated_at, finished_at }>`. `status` is `queued`, `running`, `completed` or `failed`. `rows_total` is null when the file's rows were never counted. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the caller is not a member
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');

	return json(await listContactImportJobs(userId, orgId));
};
