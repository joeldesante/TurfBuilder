import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { canOrg } from '$lib/server/permissions';

const paramsSchema = z.object({ org_id: z.uuid(), list_id: z.uuid() });

/**
 * Checks the caller is signed in and the org and list ids are well formed.
 * For the /api/v1/organizations/[org_id]/lists/[list_id] routes.
 */
export function parseListRequest(
	params: Record<string, string>,
	locals: App.Locals
): { userId: string; orgId: string; listId: string } {
	if (!locals.user) throw error(401, 'Unauthorized');

	const parsed = paramsSchema.safeParse(params);
	if (!parsed.success) throw error(400, 'Invalid organization or list id');

	return { userId: locals.user.id, orgId: parsed.data.org_id, listId: parsed.data.list_id };
}

/**
 * Throws 403 without staff access to the org and 404 when the list is not in
 * it. These routes sit outside /o/[org_slug], so hooks.server.ts has not
 * resolved the org for them; system.access is what the staff layout requires
 * to reach the list pages. Must run inside withOrgTransaction.
 */
export async function requireListAccess(
	client: PoolClient,
	userId: string,
	orgId: string,
	listId: string
): Promise<{ name: string }> {
	if (!(await canOrg(client, userId, orgId, 'system.access'))) {
		throw error(403, 'Forbidden');
	}

	const list = await client.query<{ name: string }>(
		`SELECT name FROM universe.list WHERE id = $1 AND org_id = $2`,
		[listId, orgId]
	);
	if (list.rowCount === 0) throw error(404, 'List not found');

	return list.rows[0];
}
