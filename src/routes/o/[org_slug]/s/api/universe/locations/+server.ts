import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';
import { insertLocation } from '$lib/server/locations.js';
import { LocationFieldsSchema } from '$lib/schemas/location.js';

/**
 * Creates a single location in the organization's universe, as authored from
 * the admin map. Bulk paths live under ./import.
 *
 * The location is live immediately: no location_suggestion row is written, so
 * nothing filters it out of universe.v_locations.
 *
 * @auth location.create
 * @body name {string} optional - Business name
 * @body address_line_1 {string} optional - Street address
 * @body city {string} optional
 * @body state_or_region {string} optional
 * @body postal_code {string} optional
 * @body country_code {string} optional - Two-letter code
 * @body latitude {number} required
 * @body longitude {number} required
 * @body photo_keys {string[]} optional - Spaces object keys, max 3
 * @returns { entity_id, id }
 */
export async function POST({ request, locals }) {
	if (!can(locals.organization, 'location', 'create')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const parsed = LocationFieldsSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 });
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const { entityId, versionId } = await insertLocation(
			client,
			locals.organization!.id,
			parsed.data,
			locals.user!.id,
			'manual'
		);

		return json({ entity_id: entityId, id: versionId }, { status: 201 });
	});
}
