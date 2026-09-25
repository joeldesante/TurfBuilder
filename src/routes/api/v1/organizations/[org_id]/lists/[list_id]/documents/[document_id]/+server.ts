import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withOrgTransaction } from '$lib/server/database';
import { parseListRequest, requireListAccess } from '$lib/server/list-access';
import { presignDocumentDownload } from '$lib/server/storage';

/**
 * A document's status, plus a short-lived download link once it is ready.
 * This is the URL POST .../documents hands back in Location.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { userId, orgId, listId } = parseListRequest(params, locals);
	const documentId = z.uuid().safeParse(params.document_id);
	if (!documentId.success) throw error(400, 'Invalid document id');

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
			[documentId.data, listId, orgId]
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

export const DELETE: RequestHandler = async () => {
	return new Response(null, { status: 501 });
};
