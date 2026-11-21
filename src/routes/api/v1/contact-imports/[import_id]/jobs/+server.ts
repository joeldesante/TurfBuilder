import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import {
	StartContactImportJobSchema,
	startContactImportJob
} from '$lib/server/services/contact-import-jobs.service';

/**
 * Starts importing an uploaded contact file. The job is saved first, as `queued`, and then the import function is called, which moves it to `running` and writes the rows in batches. Watch it with `GET /api/v1/contact-import-jobs/[job_id]`.
 *
 * @auth staff (system.access)
 * @body schemaId {string} required - The contact schema the contacts go into
 * @body mapping {object} required - Which CSV column fills each field: a schema field's id or a contact data id (`contact.latitude`) to the column's position from 0. Every required field needs a column
 * @returns 201 with `{ id, file_id, file_name, status, rows_total, rows_processed, rows_skipped, error, created_at, started_at, updated_at, finished_at }`. 400 for an invalid id, body, schema or mapping, 401 when signed out, 403 without staff access, 404 when the file is not in the caller's organizations or has not finished uploading, 409 when the file is already being imported, 503 when the import could not be started (the job is then saved as `failed`)
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const importId = parseId(params.import_id, 'import');
	const input = await parseBody(request, StartContactImportJobSchema);

	return json(await startContactImportJob(userId, importId, input), { status: 201 });
};
