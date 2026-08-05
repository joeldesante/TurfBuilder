import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';
import {
	createLocationVersion,
	mergeLocationFields,
	readCurrentVersion,
	softDeleteLocation
} from '$lib/server/locations.js';
import { LocationPatchSchema } from '$lib/schemas/location.js';

/**
 * Updates a location by superseding its current version.
 *
 * Nothing is overwritten: the live row is closed and a successor inserted, and
 * everything pointing at the old version row is repointed by
 * createLocationVersion.
 *
 * @auth location.update
 * @body Any subset of the location fields; omitted keys keep their current
 *   value, keys sent as null are cleared.
 * @returns { entity_id, id }
 */
export async function PATCH({ request, params, locals }) {
	if (!can(locals.organization, 'location', 'update')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const parsed = LocationPatchSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 });
	}

	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		// Doubles as the ownership check: readCurrentVersion is org-scoped, so a
		// miss means the entity belongs to another org, does not exist, or has
		// already been deleted.
		const current = await readCurrentVersion(client, orgId, params.entity_id);
		if (!current) {
			return json({ error: 'Location not found.' }, { status: 404 });
		}

		const { newVersionId } = await createLocationVersion(
			client,
			orgId,
			params.entity_id,
			mergeLocationFields(current, parsed.data),
			locals.user!.id,
			'manual'
		);

		return json({ entity_id: params.entity_id, id: newVersionId });
	});
}

/**
 * Soft-deletes a location by closing its current version without a successor.
 *
 * Version history, turf assignments, and past canvassing responses are all
 * retained; the location simply stops appearing in universe.v_locations and in
 * the operational queries, which filter on valid_to.
 *
 * @auth location.delete
 * @returns { success: true }
 */
export async function DELETE({ params, locals }) {
	if (!can(locals.organization, 'location', 'delete')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		const closed = await softDeleteLocation(client, orgId, params.entity_id);
		if (!closed) {
			return json({ error: 'Location not found.' }, { status: 404 });
		}

		return json({ success: true });
	});
}
