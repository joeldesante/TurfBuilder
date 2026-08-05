import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { insertLocation } from '$lib/server/locations.js';
import {
	findWritableTurf,
	isInsideTurf,
	countOpenSuggestions,
	MAX_OPEN_SUGGESTIONS
} from '$lib/server/suggestions.js';
import { LocationFieldsSchema } from '$lib/schemas/location.js';

/**
 * Records a business a volunteer found in the field that was not in the turf.
 *
 * Colocated under map/[id]/ rather than /s/api/ because the staff layout
 * requires an organization role, which volunteers do not have.
 *
 * The location is created tentative and attached to the turf immediately, so
 * the volunteer can knock it and submit a response right away even though it
 * never matched the bucket criteria the turf was cut from. It stays invisible
 * to search, buckets, lists, and future turf cuts until an organizer approves
 * it, which universe.v_locations enforces.
 *
 * @auth org, plus turf membership and an unexpired turf
 * @body Location fields; latitude and longitude must fall inside the turf
 * @returns { turf_location_id, entity_id }
 */
export async function POST({ request, params, locals }) {
	if (!locals.user || !locals.organization) {
		return json({ error: 'Unauthorized.' }, { status: 401 });
	}

	const parsed = LocationFieldsSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 });
	}

	const fields = parsed.data;
	const orgId = locals.organization.id;
	const userId = locals.user.id;
	const turfId = params.id;

	return withOrgTransaction(orgId, async (client) => {
		const turf = await findWritableTurf(client, turfId, userId, orgId);
		if (!turf) {
			return json(
				{ error: 'This turf is closed or you are no longer assigned to it.' },
				{ status: 403 }
			);
		}

		if (!(await isInsideTurf(client, turfId, orgId, fields.latitude, fields.longitude))) {
			return json({ error: 'Pin must be inside your turf.' }, { status: 422 });
		}

		if ((await countOpenSuggestions(client, turfId, userId)) >= MAX_OPEN_SUGGESTIONS) {
			return json(
				{ error: 'You have too many locations awaiting review on this turf.' },
				{ status: 429 }
			);
		}

		const { entityId, versionId } = await insertLocation(
			client,
			orgId,
			fields,
			userId,
			'volunteer_suggestion',
			'volunteer_suggestion'
		);

		await client.query(
			`INSERT INTO universe.location_suggestion (org_id, entity_id, turf_id, user_id, status)
			 VALUES ($1, $2, $3, $4, 'tentative')`,
			[orgId, entityId, turfId, userId]
		);

		const assignment = await client.query<{ id: string }>(
			`INSERT INTO universe.turf_location (org_id, turf_id, org_location_id)
			 VALUES ($1, $2, $3)
			 RETURNING id`,
			[orgId, turfId, versionId]
		);

		return json(
			{ turf_location_id: assignment.rows[0].id, entity_id: entityId },
			{ status: 201 }
		);
	});
}
