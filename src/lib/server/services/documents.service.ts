import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { requireDocumentOrg, requireListAccess, requireListOrg } from '$lib/server/list-access';
import { listDocumentKey, presignDocumentDownload } from '$lib/server/storage';
import { generateListDocument } from '$lib/server/services/list-document.service';

export type DocumentStatus = 'pending' | 'ready' | 'failed';

export interface DocumentSummary {
	id: string;
	list_id: string;
	status: DocumentStatus;
	error: string | null;
	created_at: string;
	completed_at: string | null;
}

export interface DocumentDetail extends DocumentSummary {
	/** Presigned link, set only when the document is ready. */
	download_url: string | null;
}

export interface CreatedDocument {
	id: string;
	list_id: string;
	status: DocumentStatus;
	created_at: string;
}

/**
 * The list's current documents (generated PDFs), newest first, at most 20.
 * Throws 404 when the list is in none of the caller's orgs and 403 without
 * staff access.
 */
export async function listDocuments(userId: string, listId: string): Promise<DocumentSummary[]> {
	const orgId = await requireListOrg(userId, listId);

	return withOrgTransaction(orgId, async (client) => {
		await requireListAccess(client, userId, orgId, listId);

		const result = await client.query<DocumentSummary>(
			`SELECT id, list_id, status, error, created_at, completed_at
			 FROM universe.list_document
			 WHERE list_id = $1 AND org_id = $2 AND deleted_at IS NULL
			 ORDER BY created_at DESC
			 LIMIT 20`,
			[listId, orgId]
		);
		return result.rows;
	});
}

/**
 * Inserts a pending document for the list, supersedes the list's earlier
 * ones, and starts generating the PDF in the background (not awaited).
 */
export async function createDocument(
	userId: string,
	listId: string,
	options: { timeZone?: string } = {}
): Promise<CreatedDocument> {
	const orgId = await requireListOrg(userId, listId);

	const document = await withOrgTransaction(orgId, async (client) => {
		await requireListAccess(client, userId, orgId, listId);

		// The key is reserved up front so the row always says where the file
		// will land, even while it is still being generated.
		const id = crypto.randomUUID();
		const result = await client.query<CreatedDocument & { storage_key: string }>(
			`INSERT INTO universe.list_document (id, org_id, list_id, storage_key, requested_by)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, list_id, storage_key, status, created_at`,
			[id, orgId, listId, listDocumentKey(orgId, listId, id), userId]
		);

		// Same transaction as the insert, so a failed insert supersedes nothing.
		// superseded_by lets a failed generation restore exactly these. Their
		// files stay in storage.
		await client.query(
			`UPDATE universe.list_document
			 SET deleted_at = now(), superseded_by = $3
			 WHERE list_id = $1 AND org_id = $2 AND deleted_at IS NULL AND id <> $3`,
			[listId, orgId, id]
		);

		return result.rows[0];
	});

	// Not awaited: generation outlives the request and reports through the row.
	void generateListDocument({
		orgId,
		documentId: document.id,
		listId,
		storageKey: document.storage_key,
		timeZone: options.timeZone
	});

	return {
		id: document.id,
		list_id: document.list_id,
		status: document.status,
		created_at: document.created_at
	};
}

/**
 * A document's status, plus a download link once it is ready. Throws 404 when
 * it is soft-deleted or in none of the caller's orgs.
 */
export async function getDocument(userId: string, documentId: string): Promise<DocumentDetail> {
	const { orgId, listId } = await requireDocumentOrg(userId, documentId);

	const { document, listName } = await withOrgTransaction(orgId, async (client) => {
		const list = await requireListAccess(client, userId, orgId, listId);

		const result = await client.query<DocumentSummary & { storage_key: string }>(
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

	return {
		...rest,
		download_url:
			document.status === 'ready' ? await presignDocumentDownload(storage_key, filename) : null
	};
}

/**
 * Soft-deletes a document. The file stays in object storage. Throws 404 when
 * it is already deleted or in none of the caller's orgs.
 */
export async function deleteDocument(userId: string, documentId: string): Promise<void> {
	const { orgId, listId } = await requireDocumentOrg(userId, documentId);

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
}
