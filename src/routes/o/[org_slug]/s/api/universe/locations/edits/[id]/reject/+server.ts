import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';

/**
 * Declines a canvasser's correction.
 *
 * The proposal is kept and marked rejected rather than deleted: unlike a
 * rejected new location, nothing bogus entered the dataset, and the record of
 * what was reported and turned down is worth having.
 *
 * @auth location.update
 * @returns { success: true }
 */
export async function POST({ params, locals }) {
	if (!can(locals.organization, 'location', 'update')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query(
			`UPDATE universe.location_edit_suggestion
			    SET status = 'rejected', reviewed_by = $1, reviewed_at = now(), updated_at = now()
			  WHERE id = $2 AND org_id = $3 AND status = 'pending'`,
			[locals.user!.id, params.id, orgId]
		);

		if (result.rowCount === 0) {
			return json({ error: 'This correction has already been reviewed.' }, { status: 409 });
		}

		return json({ success: true });
	});
}
