import { json, error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';

/**
 * Returns visit status for all locations in a turf. Caller must be a turf member.
 * Used by the volunteer map page to show which addresses have been visited.
 *
 * @auth org
 * @returns Array of { id, visited: boolean, contact_made: boolean | null }
 */
export async function GET({ locals, params }) {
	if (!locals.user) throw error(401, 'Unauthorized');

	const turfId = params.id;
	const orgId = locals.organization!.id;
	const userId = locals.user.id;

	return withOrgTransaction(orgId, async (client) => {
		const membership = await client.query(
			`SELECT id FROM turf_user WHERE turf_id = $1 AND user_id = $2 AND organization_id = $3`,
			[turfId, userId, orgId]
		);
		if (membership.rows.length === 0) throw error(403, 'Forbidden');

		const result = await client.query(
			`SELECT l.id,
			        COUNT(tla.id) > 0 AS visited,
			        (array_agg(tla.contact_made ORDER BY tla.updated_at DESC NULLS LAST))[1] AS contact_made
			 FROM location l
			 JOIN turf_location tl ON tl.location_id = l.id
			 LEFT JOIN turf_location_attempt tla ON tla.turf_location_id = tl.id
			 WHERE tl.turf_id = $1 AND tl.organization_id = $2
			 GROUP BY l.id, tl.id`,
			[turfId, orgId]
		);

		return json(result.rows);
	});
}
