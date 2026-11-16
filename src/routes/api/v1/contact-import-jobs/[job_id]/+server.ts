import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { getContactImportJob } from '$lib/server/services/contact-import-jobs.service';

/**
 * One contact import job and how far it has got: `rows_processed` of `rows_total`; `rows_skipped` of those made no contact (a missing or invalid coordinate, or a required field left blank).
 *
 * @auth staff (system.access)
 * @returns `{ id, file_id, file_name, status, rows_total, rows_processed, rows_skipped, error, created_at, started_at, updated_at, finished_at }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const jobId = parseId(params.job_id, 'job');

	return json(await getContactImportJob(userId, jobId));
};
