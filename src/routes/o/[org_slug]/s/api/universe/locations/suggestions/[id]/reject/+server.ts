import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';

/**
 * Rejects a volunteer's field addition and removes it entirely.
 *
 * Unlike the admin delete, which is soft, this is a hard delete: a rejected
 * addition is bad data, and so is anything recorded against it. Deleting the
 * entity cascades through the location versions, the turf assignment, the
 * canvassing attempt, and its survey responses.
 *
 * The status guard means an already-approved location cannot be destroyed
 * through this path; use the delete endpoint, which preserves history.
 *
 * @auth location.delete
 * @returns { success: true }
 */
export async function POST({ params, locals }) {
	if (!can(locals.organization, 'location', 'delete')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query(
			`DELETE FROM universe.org_entity oe
			  USING universe.location_suggestion ls
			  WHERE ls.id = $1
			    AND ls.org_id = $2
			    AND ls.status = 'tentative'
			    AND oe.id = ls.entity_id
			    AND oe.org_id = $2`,
			[params.id, orgId]
		);

		if (result.rowCount === 0) {
			return json({ error: 'This suggestion has already been reviewed.' }, { status: 409 });
		}

		return json({ success: true });
	});
}
