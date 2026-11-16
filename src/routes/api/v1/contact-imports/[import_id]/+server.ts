import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import {
	CompleteContactImportSchema,
	archiveContactImport,
	completeContactImport
} from '$lib/server/services/contact-imports.service';

/**
 * Reports that a contact import upload finished, how many data rows the file has, and where its rows start, which lists the file. Safe to repeat.
 *
 * @auth staff (system.access)
 * @body rowCount {number} required - Data rows, not counting the header row
 * @body rowIndex {object} required - `{ interval: 1000, offsets: number[] }`. `offsets[k]` is the byte offset where data row `k * 1000` begins, counting from the first row under the header. There is one offset per started thousand rows, in increasing order, each inside the file
 * @returns `{ id, file_name, size_bytes, row_count, uploaded_at, expires_at, preserved }`. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const importId = parseId(params.import_id, 'import');
	const input = await parseBody(request, CompleteContactImportSchema);

	return json(await completeContactImport(userId, importId, input));
};

/**
 * Archives an uploaded contact import file: it drops out of the list and can no longer be loaded. Only the record is marked; the file itself stays in storage.
 *
 * @auth staff (system.access)
 * @returns 204. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations or is already archived
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const importId = parseId(params.import_id, 'import');

	await archiveContactImport(userId, importId);

	return new Response(null, { status: 204 });
};
