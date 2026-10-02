import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { createDocument, listDocuments } from '$lib/server/services/documents.service';

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
	const userId = requireUser(locals);
	const listId = parseId(params.list_id, 'list');
	const documents = await listDocuments(userId, listId);

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
	const userId = requireUser(locals);
	const listId = parseId(params.list_id, 'list');

	// The body is optional, so an empty one is fine.
	const body = postSchema.safeParse(await request.json().catch(() => ({})));
	if (!body.success) throw error(400, body.error.issues[0].message);
	const document = await createDocument(userId, listId, body.data);

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
				Location: `/api/v1/documents/${document.id}`
			}
		}
	);
};
