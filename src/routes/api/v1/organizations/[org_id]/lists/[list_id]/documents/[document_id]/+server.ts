import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withOrgTransaction } from '$lib/server/database';
import { parseListRequest, requireListAccess } from '$lib/server/list-access';
import { presignDocumentDownload } from '$lib/server/storage';

function parseDocumentId(params: Record<string, string>): string {
	const documentId = z.uuid().safeParse(params.document_id);
	if (!documentId.success) throw error(400, 'Invalid document id');
	return documentId.data;
}

/**
 * A document's status, plus a download link once it is ready. This is the URL
 * POST .../documents hands back in Location; poll it until the status is no
 * longer `pending`. The link is a presigned object-storage URL that expires
 * after 5 minutes and downloads the file as an attachment named after the
 * list. Soft-deleted documents return 404.
 *
 * @auth staff
 * @permission system.access
 * @returns `{ id, list_id, status: 'pending' | 'ready' | 'failed', error: string | null, created_at, completed_at, download_url: string | null }`. `error` is a message safe to show users; `download_url` is set only when `status` is `ready`
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { userId, orgId, listId } = parseListRequest(params, locals);
	const documentId = parseDocumentId(params);

	const { document, listName } = await withOrgTransaction(orgId, async (client) => {
		const list = await requireListAccess(client, userId, orgId, listId);

		const result = await client.query<{
			id: string;
			list_id: string;
			storage_key: string;
			status: 'pending' | 'ready' | 'failed';
			error: string | null;
			created_at: string;
			completed_at: string | null;
		}>(
			`SELECT id, list_id, storage_key, status, error, created_at, completed_at
			 FROM universe.list_document
			 WHERE id = $1 AND list_id = $2 AND org_id = $3 AND deleted_at IS NULL`,
			[documentId, listId, orgId]
		);
		if (result.rowCount === 0) throw error(404, 'Document not found');

		return { document: result.rows[0], listName: list.name };
	});

	const { storage_key, ...rest } = document;
	const filename = `${listName.replace(/[^\w\- ]+/g, '').trim() || 'list'}.pdf`;

	return json({
		...rest,
		download_url:
			document.status === 'ready' ? await presignDocumentDownload(storage_key, filename) : null
	});
};

/**
 * Soft-deletes a document, so the list has no current PDF until one is
 * generated again. The file stays in object storage; retention cleans it up
 * later (#174). Deleting a document that is still generating lets the render
 * finish but keeps its result hidden.
 *
 * @auth staff
 * @permission system.access
 * @returns 204 No Content. 404 if the document is not on this list or is already deleted
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { userId, orgId, listId } = parseListRequest(params, locals);
	const documentId = parseDocumentId(params);

	await withOrgTransaction(orgId, async (client) => {
		await requireListAccess(client, userId, orgId, listId);

		const result = await client.query(
			`UPDATE universe.list_document
			 SET deleted_at = now()
			 WHERE id = $1 AND list_id = $2 AND org_id = $3 AND deleted_at IS NULL`,
			[documentId, listId, orgId]
		);
		if (result.rowCount === 0) throw error(404, 'Document not found');
	});

	return new Response(null, { status: 204 });
};
