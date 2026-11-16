import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { getContactImportDownload } from '$lib/server/services/contact-imports.service';

/**
 * A short-lived link to read an uploaded contact import CSV from, and the file's row index. The browser fetches the file from the link, so it never passes through this server, and can read just a slice of it with a `Range` request.
 *
 * @auth staff (system.access)
 * @returns `{ url, row_index }`. `url` is valid for a few minutes. `row_index` is `{ interval, offsets }`, where `offsets[k]` is the byte offset of data row `k * interval` (counting from the first row under the header), or null when none was recorded. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations or has not finished uploading, 503 when object storage is not set up
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const importId = parseId(params.import_id, 'import');

	const { url, rowIndex } = await getContactImportDownload(userId, importId);

	return json({ url, row_index: rowIndex });
};
