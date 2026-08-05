import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { findWritableTurf, isInsideTurf } from '$lib/server/suggestions.js';
import { findEditTarget, insertEditProposal } from '$lib/server/location-edits.js';
import { LocationEditProposalSchema } from '$lib/schemas/location.js';

/** Cap on open corrections per canvasser per turf. */
const MAX_OPEN_EDITS = 25;

/**
 * Proposes a correction to a door whose record is wrong.
 *
 * The proposal is parked for review rather than applied: the location is
 * already part of the official dataset, so a canvasser cannot change it
 * directly. Photos travel with the proposal as the evidence an organizer
 * checks before accepting it.
 *
 * Note the path parameter is the turf_location id, matching the rest of the
 * canvassing routes, rather than a location entity id.
 *
 * @auth org, plus turf membership and an unexpired turf
 * @body Any subset of the location fields, plus an optional note
 * @returns { id }
 */
export async function POST({ request, params, locals }) {
	if (!locals.user || !locals.organization) {
		return json({ error: 'Unauthorized.' }, { status: 401 });
	}

	const parsed = LocationEditProposalSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 });
	}

	const proposal = parsed.data;
	const orgId = locals.organization.id;
	const userId = locals.user.id;
	const turfId = params.id;

	// A correction with nothing in it is a no-op an organizer would have to
	// read and dismiss.
	const hasChange = [
		proposal.name,
		proposal.address_line_1,
		proposal.address_line_2,
		proposal.address_line_3,
		proposal.city,
		proposal.state_or_region,
		proposal.postal_code,
		proposal.country_code,
		proposal.latitude,
		proposal.note
	].some((v) => v !== undefined && v !== null && v !== '');
	if (!hasChange && (proposal.photo_keys?.length ?? 0) === 0) {
		return json({ error: 'Describe what is wrong before sending a correction.' }, { status: 400 });
	}

	return withOrgTransaction(orgId, async (client) => {
		const turf = await findWritableTurf(client, turfId, userId, orgId);
		if (!turf) {
			return json(
				{ error: 'This turf is closed or you are no longer assigned to it.' },
				{ status: 403 }
			);
		}

		const target = await findEditTarget(client, params.location_id, turfId, orgId);
		if (!target) {
			return json({ error: 'Location not found in this turf.' }, { status: 404 });
		}

		if (
			proposal.latitude !== undefined &&
			proposal.longitude !== undefined &&
			!(await isInsideTurf(client, turfId, orgId, proposal.latitude, proposal.longitude))
		) {
			return json({ error: 'Pin must be inside your turf.' }, { status: 422 });
		}

		const open = await client.query<{ n: number }>(
			`SELECT count(*)::int AS n
			   FROM universe.location_edit_suggestion
			  WHERE turf_id = $1 AND user_id = $2 AND status = 'pending'`,
			[turfId, userId]
		);
		if ((open.rows[0]?.n ?? 0) >= MAX_OPEN_EDITS) {
			return json(
				{ error: 'You have too many corrections awaiting review on this turf.' },
				{ status: 429 }
			);
		}

		const id = await insertEditProposal(client, orgId, target, turfId, userId, proposal);

		return json({ id }, { status: 201 });
	});
}
