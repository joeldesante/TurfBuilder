import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import {
	createLocationVersion,
	mergeLocationFields,
	readCurrentVersion
} from '$lib/server/locations.js';
import { findEditableSuggestion, isInsideTurf } from '$lib/server/suggestions.js';
import { LocationPatchSchema } from '$lib/schemas/location.js';

const LOCKED =
	'This addition can no longer be changed. It has been reviewed, or your turf has closed.';

/**
 * Corrects a location the volunteer added during this canvassing session.
 *
 * Editable only while they authored it, it is still tentative, and the turf is
 * still open — see findEditableSuggestion. Once an organizer approves it or
 * the turf expires, the volunteer loses the handle.
 *
 * The correction is a new version, so the original text the volunteer typed is
 * still recoverable.
 *
 * @auth org, plus authorship of a tentative suggestion on an unexpired turf
 * @returns { entity_id, id }
 */
export async function PATCH({ request, params, locals }) {
	if (!locals.user || !locals.organization) {
		return json({ error: 'Unauthorized.' }, { status: 401 });
	}

	const parsed = LocationPatchSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 });
	}

	const orgId = locals.organization.id;
	const userId = locals.user.id;

	return withOrgTransaction(orgId, async (client) => {
		const editable = await findEditableSuggestion(
			client,
			params.entity_id,
			params.id,
			userId,
			orgId
		);
		if (!editable) {
			return json({ error: LOCKED }, { status: 403 });
		}

		const current = await readCurrentVersion(client, orgId, params.entity_id);
		if (!current) {
			return json({ error: 'Location not found.' }, { status: 404 });
		}

		const merged = mergeLocationFields(current, parsed.data);

		// Only re-check the geofence when the pin actually moved.
		const moved =
			merged.latitude !== current.latitude || merged.longitude !== current.longitude;
		if (moved && !(await isInsideTurf(client, params.id, orgId, merged.latitude, merged.longitude))) {
			return json({ error: 'Pin must be inside your turf.' }, { status: 422 });
		}

		const { newVersionId } = await createLocationVersion(
			client,
			orgId,
			params.entity_id,
			merged,
			userId,
			'volunteer_suggestion'
		);

		return json({ entity_id: params.entity_id, id: newVersionId });
	});
}

/**
 * Withdraws a location the volunteer added by mistake.
 *
 * A hard delete, unlike the admin soft delete: an unreviewed suggestion has no
 * history worth keeping, and leaving it would put a phantom door on the turf.
 * The cascade takes the location, its turf assignment, and any attempt or
 * survey responses recorded against it.
 *
 * @auth org, plus authorship of a tentative suggestion on an unexpired turf
 * @returns { success: true }
 */
export async function DELETE({ params, locals }) {
	if (!locals.user || !locals.organization) {
		return json({ error: 'Unauthorized.' }, { status: 401 });
	}

	const orgId = locals.organization.id;
	const userId = locals.user.id;

	return withOrgTransaction(orgId, async (client) => {
		const editable = await findEditableSuggestion(
			client,
			params.entity_id,
			params.id,
			userId,
			orgId
		);
		if (!editable) {
			return json({ error: LOCKED }, { status: 403 });
		}

		await client.query(`DELETE FROM universe.org_entity WHERE id = $1 AND org_id = $2`, [
			params.entity_id,
			orgId
		]);

		return json({ success: true });
	});
}
