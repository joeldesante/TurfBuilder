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
				 FROM turf WHERE id = $1 AND organization_id = $2`,
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
					COALESCE(pl.name, ol.name, l.location_name) AS name,
					COALESCE(pl.address_line_1, ol.address_line_1, l.street) AS address_line_1,
					COALESCE(pl.city, ol.city, l.locality) AS city,
					COALESCE(pl.state_or_region, ol.state_or_region, l.region) AS state_or_region,
					COALESCE(
						ST_Y(pl.coordinates),
						ST_Y(ol.coordinates),
						l.latitude::float
					) AS latitude,
					COALESCE(
						ST_X(pl.coordinates),
						ST_X(ol.coordinates),
						l.longitude::float
					) AS longitude,
					(
						SELECT tla.contact_made
						FROM turf_location_attempt tla
						WHERE tla.turf_location_id = tl.id
						ORDER BY tla.updated_at DESC
						LIMIT 1
					) AS contact_made
				FROM turf_location tl
				LEFT JOIN universe.public_location pl ON tl.universe_public_location_id = pl.id
				LEFT JOIN universe.org_location ol ON tl.universe_org_location_id = ol.id
				LEFT JOIN location l ON tl.location_id = l.id
				WHERE tl.turf_id = $1 AND tl.organization_id = $2
				AND COALESCE(ST_Y(pl.coordinates), ST_Y(ol.coordinates), l.latitude::float) IS NOT NULL
				ORDER BY COALESCE(pl.name, ol.name, l.location_name)`,
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
