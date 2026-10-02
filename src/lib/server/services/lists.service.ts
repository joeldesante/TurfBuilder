import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { requireBucketOrg } from '$lib/server/list-access';
import { canOrg } from '$lib/server/permissions';

export interface List {
	id: string;
	name: string;
	bucket: string;
	entity_type: 'people' | 'locations';
	expires_at: string;
	created_at: string;
}

/** The lists in a bucket, newest first. 404 when it is in none of the caller's orgs, 403 without staff access. */
export async function listBucketLists(userId: string, bucketId: string): Promise<List[]> {
	const orgId = await requireBucketOrg(userId, bucketId);

	return withOrgTransaction(orgId, async (client) => {
		if (!(await canOrg(client, userId, orgId, 'system.access'))) throw error(403, 'Forbidden');

		const result = await client.query<List>(
			`SELECT id, name, bucket, entity_type, expires_at, created_at
			 FROM universe.list
			 WHERE bucket = $1 AND org_id = $2
			 ORDER BY created_at DESC`,
			[bucketId, orgId]
		);
		return result.rows;
	});
}
