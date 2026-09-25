import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withOrgTransaction } from '$lib/server/database';
import { parseListRequest, requireListAccess } from '$lib/server/list-access';
import { listDocumentKey } from '$lib/server/storage';
import { generateListDocument } from '$lib/server/services/list-document.service';

/**
 * The caller's IANA timezone, used to print times on the document. Temporary:
 * a per-org setting with an infrastructure default replaces it (#183).
 */
const postSchema = z.object({
	timeZone: z
		.string()
		.refine((zone) => {
			try {
				new Intl.DateTimeFormat('en-US', { timeZone: zone });
				return true;
			} catch {
				return false;
			}
		}, 'Unknown timezone')
		.optional()
});

/**
 * The list's current documents (generated PDFs), newest first. Replaced and
 * deleted documents are not included, so this is normally at most one, plus a
 * failed attempt when a regeneration failed and the previous PDF was restored.
 * No download links here; fetch a document by id for that.
 *
 * @auth staff
 * @permission system.access
 * @returns `Array<{ id, list_id, status: 'pending' | 'ready' | 'failed', error: string | null, created_at, completed_at }>`, at most 20
 */
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
 * Starts generating a printable PDF of the list: a master list of every
 * location, the turf checkout list, and one page per cut turf, with numbered
 * maps. The new document replaces the list's earlier ones (they are
 * soft-deleted) and they are restored if generation fails. Responds 202 as
 * soon as the row exists; poll the `Location` URL until the status is `ready`
 * or `failed`. Generation fails after 90 seconds. Only location lists can be
 * generated; a people list fails with a message saying so.
 *
 * @auth staff
 * @permission system.access
 * @body timeZone {string} - IANA timezone to print times in, e.g. `America/New_York`. Defaults to the server's zone. Temporary until organizations have a timezone setting (#183)
 * @returns 202 `{ id, list_id, status: 'pending', created_at }` with a `Location` header pointing at the document. 400 for an unknown timezone
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const { userId, orgId, listId } = parseListRequest(params, locals);

	// The body is optional, so an empty one is fine.
	const body = postSchema.safeParse(await request.json().catch(() => ({})));
	if (!body.success) throw error(400, body.error.issues[0].message);

	const document = await withOrgTransaction(orgId, async (client) => {
		await requireListAccess(client, userId, orgId, listId);

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
		timeZone: body.data.timeZone
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
