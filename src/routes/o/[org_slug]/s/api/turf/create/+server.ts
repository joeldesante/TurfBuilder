import { json } from '@sveltejs/kit';
import { customAlphabet } from 'nanoid';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers';

/**
 * Creates one or more turfs from GeoJSON polygon geometries. For each polygon,
 * PostGIS ST_Contains automatically assigns all locations within its bounds.
 * Each turf receives a unique 6-character join code. Defaults to a 7-day expiry.
 *
 * @auth staff
 * @permission turf:create
 * @body polygons {Array<{geometry: GeoJSON}>} required - GeoJSON polygon geometries defining each turf boundary
 * @body survey_id {string} required - UUID of the survey to attach to all created turfs
 * @body expires_at {string} - ISO 8601 expiration date; defaults to 7 days from now
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
		const { polygons, survey_id, expires_at } = await request.json();

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

				const result = await client.query(
					`INSERT INTO turf (code, bounds, author_id, survey_id, organization_id, created_at, expires_at)
					 VALUES ($1, $2, $3, $4, $5, NOW(), $6)
					 RETURNING *`,
					[
						turf_code,
						JSON.stringify(polygon.geometry),
						locals.user!.id,
						survey_id,
						locals.organization!.id,
						expirationDate
					]
				);

				const locations = await client.query(
					`SELECT id, tier FROM location_unified
					 WHERE ST_Contains(ST_GeomFromGeoJSON($1::text), geom)`,
					[JSON.stringify(polygon.geometry)]
				);

				for (const location of locations.rows) {
					if (location.tier === 'tier1') {
						await client.query(
							`INSERT INTO turf_location (turf_id, location_id, organization_id)
							 VALUES ($1, $2, $3)
							 ON CONFLICT DO NOTHING`,
							[result.rows[0].id, location.id, locals.organization!.id]
						);
					} else {
						await client.query(
							`INSERT INTO turf_location (turf_id, org_location_id, organization_id)
							 VALUES ($1, $2, $3)
							 ON CONFLICT DO NOTHING`,
							[result.rows[0].id, location.id, locals.organization!.id]
						);
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
