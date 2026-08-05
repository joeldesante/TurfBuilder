import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';
import { findPendingProposal, applyApprovedProposal } from '$lib/server/location-edits.js';

/**
 * Accepts a canvasser's correction into the official dataset.
 *
 * The correction becomes a new version of the location, so the values it
 * replaces stay recoverable. Where the door came from the shared public pool,
 * which no organization may write to, this forks an org-private copy instead
 * and repoints the turf assignments onto it.
 *
 * @auth location.update
 * @returns { entity_id, forked }
 */
export async function POST({ params, locals }) {
	if (!can(locals.organization, 'location', 'update')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const orgId = locals.organization!.id;
	const reviewerId = locals.user!.id;

	return withOrgTransaction(orgId, async (client) => {
		const proposal = await findPendingProposal(client, params.id, orgId);
		if (!proposal) {
			return json({ error: 'This correction has already been reviewed.' }, { status: 409 });
		}

		const applied = await applyApprovedProposal(client, orgId, proposal, reviewerId);
		if (!applied) {
			return json({ error: 'The location this refers to no longer exists.' }, { status: 409 });
		}

		await client.query(
			`UPDATE universe.location_edit_suggestion
			    SET status = 'approved', reviewed_by = $1, reviewed_at = now(), updated_at = now()
			  WHERE id = $2 AND org_id = $3`,
			[reviewerId, params.id, orgId]
		);

		return json({ entity_id: applied.entityId, forked: applied.forked });
	});
}
