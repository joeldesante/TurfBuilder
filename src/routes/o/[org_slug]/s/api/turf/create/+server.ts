import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { customAlphabet } from 'nanoid';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers';
import { logger } from '$lib/server/logger';

const CreateTurfsSchema = z.object({
	polygons: z
		.array(z.object({ geometry: z.record(z.string(), z.unknown()) }))
		.min(1, 'At least one polygon is required.'),
	survey_id: z.string().uuid('Invalid survey ID.'),
	script_id: z.string().uuid().nullable().optional(),
	expires_at: z.coerce.date().optional(),
	list_id: z.string().uuid('Invalid list ID.')
});

/**
 * Creates one or more turfs from GeoJSON polygon geometries.
 *
 * Turfs are always cut from a universe list: locations are sourced from
 * `universe.list_entry` for that list using ST_Contains, and the created
 * turfs belong to the list. Each turf receives a unique 6-character join
 * code. Defaults to a 7-day expiry.
 *
 * @auth staff
 * @permission turf:create
 * @body polygons {Array<{geometry: GeoJSON}>} required - GeoJSON polygon geometries
 * @body survey_id {string} required - UUID of the survey to attach to all created turfs
 * @body script_id {string} - UUID of the script to attach to all created turfs
 * @body expires_at {string} - ISO 8601 expiration date; defaults to 7 days from now
 * @body list_id {string} required - UUID of the universe list this cut derives from
 * @returns { turfs: Turf[] } Array of created turf records
 */
export async function POST({ request, locals }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!can(locals.organization, 'turf', 'create')) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const parsed = CreateTurfsSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 });
	}
	const { polygons, survey_id, script_id, expires_at, list_id } = parsed.data;

	const nanoid = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

	const expirationDate = expires_at ?? new Date();
	if (!expires_at) {
		expirationDate.setDate(expirationDate.getDate() + 7);
	}

	try {
		const insertedTurfs = await withOrgTransaction(locals.organization.id, async (client) => {
			const listCheck = await client.query(
				`SELECT id FROM universe.list WHERE id = $1 AND org_id = $2`,
				[list_id, locals.organization!.id]
			);
			if (listCheck.rows.length === 0) {
				throw Object.assign(new Error('List not found'), { status: 404 });
			}

			const turfs = [];

			for (const polygon of polygons) {
				const turf_code = nanoid();
				const geojson = JSON.stringify(polygon.geometry);

				const result = await client.query(
					`INSERT INTO universe.turf (code, bounds, author_id, survey_id, script_id, org_id, expires_at, list_id)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
					 RETURNING *`,
					[
						turf_code,
						geojson,
						locals.user!.id,
						survey_id,
						script_id ?? null,
						locals.organization!.id,
						expirationDate,
						list_id
					]
				);

				const turfId = result.rows[0].id;

				// Assign locations from the list that fall within the polygon.
				await client.query(
					`INSERT INTO universe.turf_location (turf_id, public_location_id, org_location_id, org_id)
					 SELECT
						$1,
						CASE WHEN le.record_source = 'public_location' THEN le.record_id END,
						CASE WHEN le.record_source = 'org_location' THEN le.record_id END,
						$3
					 FROM universe.list_entry le
					 LEFT JOIN universe.public_location pl
						ON le.record_source = 'public_location' AND pl.id = le.record_id
					 LEFT JOIN universe.org_location ol
						ON le.record_source = 'org_location' AND ol.id = le.record_id
					 WHERE le.list_id = $4
					   AND le.record_source IN ('public_location', 'org_location')
					   AND ST_Contains(ST_GeomFromGeoJSON($2::text), COALESCE(pl.coordinates, ol.coordinates))
					 ON CONFLICT DO NOTHING`,
					[turfId, geojson, locals.organization!.id, list_id]
				);

				turfs.push(result.rows[0]);
			}

			return turfs;
		});

		return json({ turfs: insertedTurfs }, { status: 201 });
	} catch (error) {
		const status = (error as { status?: number }).status;
		if (status === 404) {
			return json({ error: 'List not found' }, { status: 404 });
		}
		logger.error({ err: error }, 'Error creating turfs');
		return json({ error: 'Failed to create turfs' }, { status: 500 });
	}
}
