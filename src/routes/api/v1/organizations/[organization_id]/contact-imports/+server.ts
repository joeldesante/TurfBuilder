import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import {
	ContactImportUploadSchema,
	createContactImportUpload,
	listContactImports
} from '$lib/server/services/contact-imports.service';

/**
 * The organization's uploaded contact import files that finished uploading, newest first.
 *
 * @auth org staff (system.access)
 * @returns `Array<{ id, file_name, size_bytes, row_count, uploaded_at, expires_at, preserved }>`. `row_count` is null until counted; `expires_at` is when the file is due to be purged unless `preserved`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the caller is not a member
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');

	return json(await listContactImports(userId, orgId));
};

/**
 * Starts a contact import upload: records the file and answers a presigned PUT the browser sends the CSV to. The file is listed once `PATCH /api/v1/contact-imports/[import_id]` reports it finished.
 *
 * @auth org staff (system.access)
 * @body fileName {string} required - The file's name, max 255 characters
 * @body contentLength {number} required - Byte size, max 50,000,000
 * @returns 201 with `{ id, url, key }`. Send the file to `url` with `Content-Type: text/csv`. 400 for an invalid body or id, 401 when signed out, 403 without staff access, 404 when the caller is not a member, 503 when object storage is not set up
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');
	const input = await parseBody(request, ContactImportUploadSchema);

	return json(await createContactImportUpload(userId, orgId, input), { status: 201 });
};
