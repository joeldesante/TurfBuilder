import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withOrgTransaction } from '$lib/server/database';
import { parseListRequest, requireListAccess } from '$lib/server/list-access';
import { listDocumentKey } from '$lib/server/storage';
import { generateListDocument } from '$lib/server/services/list-document.service';

/** The list's documents, newest first. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { userId, orgId, listId } = parseListRequest(params, locals);

	const documents = await withOrgTransaction(orgId, async (client) => {
		await requireListAccess(client, userId, orgId, listId);

		const result = await client.query(
			`SELECT id, list_id, status, error, created_at, completed_at
			 FROM universe.list_document
			 WHERE list_id = $1 AND org_id = $2 AND deleted_at IS NULL
			 ORDER BY created_at DESC
			 LIMIT 20`,
			[listId, orgId]
		);
		return result.rows;
	});

	return json(documents);
};

/**
 * Starts generating a document for a list, soft-deleting the list's earlier
 * ones so it replaces them. Responds 202 as soon as the row exists; poll the
 * Location URL for its status.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const { userId, orgId, listId } = parseListRequest(params, locals);

	const document = await withOrgTransaction(orgId, async (client) => {
		await requireListAccess(client, userId, orgId, listId);

		// Same transaction as the insert, so the list is never left without a
		// current document if the insert fails. Their files stay in storage.
		await client.query(
			`UPDATE universe.list_document
			 SET deleted_at = now()
			 WHERE list_id = $1 AND org_id = $2 AND deleted_at IS NULL`,
			[listId, orgId]
		);

		// The key is reserved up front so the row always says where the file
		// will land, even while it is still being generated.
		const id = crypto.randomUUID();
		const result = await client.query<{
			id: string;
			list_id: string;
			storage_key: string;
			status: string;
			created_at: string;
		}>(
			`INSERT INTO universe.list_document (id, org_id, list_id, storage_key, requested_by)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, list_id, storage_key, status, created_at`,
			[id, orgId, listId, listDocumentKey(orgId, listId, id), userId]
		);
		return result.rows[0];
	});

	// Not awaited: generation outlives the request and reports through the row.
	void generateListDocument({
		orgId,
		documentId: document.id,
		listId,
		storageKey: document.storage_key
	});

	return json(
		{
			id: document.id,
			list_id: document.list_id,
			status: document.status,
			created_at: document.created_at
		},
		{
			status: 202,
			headers: {
				Location: `/api/v1/organizations/${orgId}/lists/${listId}/documents/${document.id}`
			}
		}
	);
};
