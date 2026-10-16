import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { deleteDocument, getDocument } from '$lib/server/services/documents.service';

/**
 * A list document's status, plus a download link once it is ready. This is
 * the URL POST /api/v1/lists/{list_id}/documents hands back in Location; poll
 * it until the status is no longer `pending`. The link is a presigned
 * object-storage URL that expires after 5 minutes and downloads the file as an
 * attachment named after the list. Soft-deleted documents, and documents
 * outside the caller's organizations, return 404.
 *
 * @auth staff
 * @permission system.access
 * @returns `{ id, list_id, status: 'pending' | 'ready' | 'failed', error: string | null, created_at, completed_at, download_url: string | null }`. `error` is a message safe to show users; `download_url` is set only when `status` is `ready`
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const documentId = parseId(params.document_id, 'document');

	return json(await getDocument(userId, documentId));
};

/**
 * Soft-deletes a list document, so the list has no current PDF until one is
 * generated again. The file stays in object storage; retention cleans it up
 * later (#174). Deleting a document that is still generating lets the render
 * finish but keeps its result hidden.
 *
 * @auth staff
 * @permission system.access
 * @returns 204 No Content. 404 if the document is not in the caller's organizations or is already deleted
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const documentId = parseId(params.document_id, 'document');

	await deleteDocument(userId, documentId);

	return new Response(null, { status: 204 });
};
