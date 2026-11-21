import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { canOrg } from '$lib/server/permissions';

/** Throws 403 unless the user holds `key` in the org. Must run inside `withOrgTransaction`. */
export async function requirePermission(
	client: PoolClient,
	userId: string,
	orgId: string,
	key: string
): Promise<void> {
	if (!(await canOrg(client, userId, orgId, key))) throw error(403, 'Forbidden');
}
