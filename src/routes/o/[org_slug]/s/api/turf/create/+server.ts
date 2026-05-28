import { json } from '@sveltejs/kit';
import { customAlphabet } from 'nanoid';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers';

/**
 * Creates one or more turfs from GeoJSON polygon geometries.
 *
 * When called from the universe list-based cut flow, supply `list_id` and `bucket_id`.
 * Locations are then sourced from `universe.list_entry` for that list using ST_Contains.
 *
 * When called without a list context, locations are sourced from `location_unified`
 * (the traditional two-tier location pool) using ST_Contains.
 *
 * Each turf receives a unique 6-character join code. Defaults to a 7-day expiry.
 *
 * @auth staff
 * @permission turf:create
 * @body polygons {Array<{geometry: GeoJSON}>} required - GeoJSON polygon geometries
 * @body survey_id {string} required - UUID of the survey to attach to all created turfs
 * @body expires_at {string} - ISO 8601 expiration date; defaults to 7 days from now
 * @body list_id {string} - UUID of the universe list this cut derives from
 * @body bucket_id {string} - UUID of the universe bucket this cut derives from
 * @returns { turfs: Turf[] } Array of created turf records
 */
export async function POST({ request, locals }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!can(locals.organization, 'turf', 'create')) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const { polygons, survey_id, expires_at, list_id, bucket_id } = await request.json();

		if (!polygons || !Array.isArray(polygons) || polygons.length === 0) {
			return json({ error: 'Invalid polygons data' }, { status: 400 });
		}

		if (!survey_id) {
			return json({ error: 'survey_id is required' }, { status: 400 });
		}

		const nanoid = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

		const expirationDate = expires_at ? new Date(expires_at) : new Date();
		if (!expires_at) {
			expirationDate.setDate(expirationDate.getDate() + 7);
		}

		const insertedTurfs = await withOrgTransaction(locals.organization.id, async (client) => {
			const turfs = [];

			for (const polygon of polygons) {
				const turf_code = nanoid();
				const geojson = JSON.stringify(polygon.geometry);

				const result = await client.query(
					`INSERT INTO turf (code, bounds, author_id, survey_id, organization_id, created_at, expires_at, bucket_id, list_id)
					 VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)
					 RETURNING *`,
					[
						turf_code,
						geojson,
						locals.user!.id,
						survey_id,
						locals.organization!.id,
						expirationDate,
						bucket_id ?? null,
						list_id ?? null
					]
				);

				const turfId = result.rows[0].id;

				if (list_id) {
					// Universe list-based cut: assign locations from the list that fall within the polygon.
					const universeLocations = await client.query<{ record_id: string; record_source: string }>(
						`SELECT le.record_id, le.record_source
						 FROM universe.list_entry le
						 LEFT JOIN universe.public_location pl
						 	ON le.record_source = 'public_location' AND pl.id = le.record_id
						 LEFT JOIN universe.org_location ol
						 	ON le.record_source = 'org_location' AND ol.id = le.record_id
						 WHERE le.list_id = $1
						 AND ST_Contains(ST_GeomFromGeoJSON($2::text), COALESCE(pl.coordinates, ol.coordinates))`,
						[list_id, geojson]
					);

					for (const loc of universeLocations.rows) {
						if (loc.record_source === 'public_location') {
							await client.query(
								`INSERT INTO turf_location (turf_id, universe_public_location_id, organization_id)
								 VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
								[turfId, loc.record_id, locals.organization!.id]
							);
						} else {
							await client.query(
								`INSERT INTO turf_location (turf_id, universe_org_location_id, organization_id)
								 VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
								[turfId, loc.record_id, locals.organization!.id]
							);
						}
					}
				} else {
					// Traditional cut: assign locations from location_unified within the polygon.
					const locations = await client.query(
						`SELECT id, tier FROM location_unified
						 WHERE ST_Contains(ST_GeomFromGeoJSON($1::text), geom)`,
						[geojson]
					);

					for (const location of locations.rows) {
						if (location.tier === 'tier1') {
							await client.query(
								`INSERT INTO turf_location (turf_id, location_id, organization_id)
								 VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
								[turfId, location.id, locals.organization!.id]
							);
						} else {
							await client.query(
								`INSERT INTO turf_location (turf_id, org_location_id, organization_id)
								 VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
								[turfId, location.id, locals.organization!.id]
							);
						}
					}
				}

				turfs.push(result.rows[0]);
			}

			return turfs;
		});

		return json({ turfs: insertedTurfs }, { status: 201 });
	} catch (error) {
		console.error('Error creating turfs:', error);
		return json({ error: 'Failed to create turfs' }, { status: 500 });
	}
}
