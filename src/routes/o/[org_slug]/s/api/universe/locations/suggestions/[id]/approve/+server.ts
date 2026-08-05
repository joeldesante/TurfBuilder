import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';

/**
 * Accepts a volunteer's field addition into the organization's universe.
 *
 * Flipping the status is the whole operation: the turf assignment already
 * exists, and universe.v_locations stops excluding the location the moment it
 * is no longer tentative, so it becomes visible to search, buckets, and future
 * turf cuts at once.
 *
 * It is deliberately not backfilled into already-cut lists — those are frozen
 * snapshots — so it joins the next cut instead.
 *
 * @auth location.create
 * @returns { entity_id }
 */
export async function POST({ params, locals }) {
	if (!can(locals.organization, 'location', 'create')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<{ entity_id: string }>(
			`UPDATE universe.location_suggestion
			    SET status = 'approved',
			        reviewed_by = $1,
			        reviewed_at = now(),
			        updated_at = now()
			  WHERE id = $2 AND org_id = $3 AND status = 'tentative'
			  RETURNING entity_id`,
			[locals.user!.id, params.id, orgId]
		);

		if (result.rows.length === 0) {
			return json({ error: 'This suggestion has already been reviewed.' }, { status: 409 });
		}

		return json({ entity_id: result.rows[0].entity_id });
	});
}
