import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';
import { insertLocation, LOCATION_ROW_COLUMNS } from '$lib/server/locations.js';
import { LocationFieldsSchema } from '$lib/schemas/location.js';

/**
 * Ceiling on markers returned for one viewport. High enough that a city-block
 * view is complete, low enough that a zoomed-out view cannot try to serialize
 * an entire imported universe into the browser.
 */
export const MAX_VIEWPORT_LOCATIONS = 2000;

const ViewportSchema = z.object({
	west: z.coerce.number().min(-180).max(180),
	south: z.coerce.number().min(-90).max(90),
	east: z.coerce.number().min(-180).max(180),
	north: z.coerce.number().min(-90).max(90)
});

/**
 * Splits a viewport into the boxes PostGIS can envelope. A map panned across
 * the antimeridian reports a western edge greater than its eastern one; passed
 * to ST_MakeEnvelope as-is that describes an inside-out box and matches
 * nothing, so it becomes two boxes meeting at 180 degrees.
 */
function envelopes(v: z.infer<typeof ViewportSchema>): [number, number, number, number][] {
	if (v.west <= v.east) return [[v.west, v.south, v.east, v.north]];
	return [
		[v.west, v.south, 180, v.north],
		[-180, v.south, v.east, v.north]
	];
}

/**
 * Locations drawn on the admin map, for the viewport the map is showing.
 *
 * The map queries by viewport rather than reusing the list page's rows because
 * that page is a paginated alphabetical window: a location outside the first
 * page is a location the map would never draw, including the one the organizer
 * just placed.
 *
 * @auth location.read
 * @query west,south,east,north {number} required - Viewport corners in degrees
 * @returns { locations, truncated }
 */
export async function GET({ url, locals }) {
	if (!can(locals.organization, 'location', 'read')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const parsed = ViewportSchema.safeParse(Object.fromEntries(url.searchParams));
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 });
	}

	const orgId = locals.organization!.id;
	const boxes = envelopes(parsed.data);

	// $1 is the org, so each box's four corners start at $2.
	const predicate = boxes
		.map((_, i) => {
			const p = 2 + i * 4;
			return `ol.coordinates && ST_MakeEnvelope($${p}, $${p + 1}, $${p + 2}, $${p + 3}, 4326)`;
		})
		.join(' OR ');

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query(
			`SELECT ${LOCATION_ROW_COLUMNS}
			   FROM universe.org_location ol
			   LEFT JOIN universe.location_suggestion ls ON ls.entity_id = ol.entity_id
			  WHERE ol.org_id = $1 AND ol.valid_to IS NULL
			    AND (${predicate})
			  ORDER BY ol.id
			  LIMIT ${MAX_VIEWPORT_LOCATIONS + 1}`,
			[orgId, ...boxes.flat()]
		);

		// One row over the cap only ever proves there are more; it is never sent.
		const truncated = result.rows.length > MAX_VIEWPORT_LOCATIONS;
		return json({
			locations: truncated ? result.rows.slice(0, MAX_VIEWPORT_LOCATIONS) : result.rows,
			truncated
		});
	});
}

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
