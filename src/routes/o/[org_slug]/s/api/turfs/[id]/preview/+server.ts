import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';

/**
 * Returns the polygon bounds and all assigned locations for a turf, for map preview.
 *
 * @auth staff
 * @permission turf:read
 * @returns { bounds: string, locations: LocationPreview[] }
 */
export async function GET({ params, locals }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const result = await withOrgTransaction(locals.organization.id, async (client) => {
			const turfResult = await client.query<{ id: string; code: string; bounds: string | null }>(
				`SELECT id, code, ST_AsGeoJSON(bounds)::text AS bounds
				 FROM universe.turf WHERE id = $1 AND org_id = $2`,
				[params.id, locals.organization!.id]
			);

			if (turfResult.rows.length === 0) return null;
			const turf = turfResult.rows[0];

			const locationsResult = await client.query<{
				id: string;
				name: string | null;
				address_line_1: string | null;
				city: string | null;
				state_or_region: string | null;
				latitude: number;
				longitude: number;
				contact_made: boolean | null;
			}>(
				`SELECT
					tl.id,
					ol.name AS name,
					ol.address_line_1 AS address_line_1,
					ol.city AS city,
					ol.state_or_region AS state_or_region,
					ST_Y(ol.coordinates) AS latitude,
					ST_X(ol.coordinates) AS longitude,
					(
						SELECT tla.contact_made
						FROM universe.turf_location_attempt tla
						WHERE tla.turf_location_id = tl.id
						ORDER BY tla.updated_at DESC
						LIMIT 1
					) AS contact_made
				FROM universe.turf_location tl
				JOIN universe.org_location ol ON tl.org_location_id = ol.id
				WHERE tl.turf_id = $1 AND tl.org_id = $2
				AND ol.coordinates IS NOT NULL
				AND ol.valid_to IS NULL
				ORDER BY ol.name`,
				[turf.id, locals.organization!.id]
			);

			return { turf, locations: locationsResult.rows };
		});

		if (!result) return json({ error: 'Turf not found' }, { status: 404 });

		return json(result);
	} catch (err) {
		console.error('Error fetching turf preview:', err);
		return json({ error: 'Failed to fetch turf preview' }, { status: 500 });
	}
}
