import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { requireActiveMembership } from '$lib/server/list-access';

/**
 * Turfs: the walkable pieces cut from a list, which canvassers join with a
 * six-character code.
 */

/**
 * Adds the caller to the org's turf with this join code and returns the
 * turf's id. Any member may join, staff or not. Joining a turf the caller is
 * already on changes nothing. 404 for a code no turf in the org has.
 */
export async function joinTurfByCode(
	userId: string,
	orgId: string,
	code: string
): Promise<{ id: string }> {
	await requireActiveMembership(userId, orgId);

	const turf = await withOrgTransaction(orgId, async (client) => {
		const found = await client.query<{ id: string }>(
			`SELECT id FROM universe.turf WHERE code = $1 AND org_id = $2`,
			[code, orgId]
		);
		const turf = found.rows[0];
		if (!turf) return null;

		await client.query(
			`INSERT INTO universe.turf_user (turf_id, user_id, org_id)
			 VALUES ($1, $2, $3)
			 ON CONFLICT DO NOTHING`,
			[turf.id, userId, orgId]
		);
		return turf;
	});
	if (!turf) throw error(404, 'Invalid code');

	return { id: turf.id };
}
