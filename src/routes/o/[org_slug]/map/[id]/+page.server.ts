import { redirect, error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';

export async function load({ locals, params }) {
	const turfId = params.id;
	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		const ownership = await client.query(
			`SELECT id FROM universe.turf WHERE id = $1 AND org_id = $2`,
			[turfId, orgId]
		);
		if (ownership.rows.length === 0) {
			throw error(404, 'Turf not found.');
		}

		const locationsRes = await client.query(
			`SELECT
			        tl.id AS id,
			        COALESCE(pl.name, ol.name) AS location_name,
			        ST_Y(COALESCE(pl.coordinates, ol.coordinates)) AS latitude,
			        ST_X(COALESCE(pl.coordinates, ol.coordinates)) AS longitude,
			        COALESCE(pl.address_line_1, ol.address_line_1) AS street,
			        COALESCE(pl.city, ol.city) AS locality,
			        COALESCE(pl.postal_code, ol.postal_code) AS postcode,
			        COALESCE(pl.state_or_region, ol.state_or_region) AS region,
			        COALESCE(pl.country_code, ol.country_code) AS country,
			        COUNT(tla.id) > 0 AS visited,
			        (array_agg(tla.contact_made ORDER BY tla.updated_at DESC NULLS LAST))[1] AS contact_made
			 FROM universe.turf_location tl
			 LEFT JOIN universe.public_location pl ON pl.id = tl.public_location_id
			 LEFT JOIN universe.org_location ol ON ol.id = tl.org_location_id
			 LEFT JOIN universe.turf_location_attempt tla ON tla.turf_location_id = tl.id
			 WHERE tl.turf_id = $1 AND tl.org_id = $2
			 GROUP BY tl.id, pl.id, ol.id
			 LIMIT 500`,
			[turfId, orgId]
		);

		if (locationsRes.rows.length === 0) {
			throw redirect(303, '/');
		}

		const centerRes = await client.query(
			`SELECT
				ST_Y(ST_Centroid(ST_Collect(COALESCE(pl.coordinates, ol.coordinates)))) AS latitude,
				ST_X(ST_Centroid(ST_Collect(COALESCE(pl.coordinates, ol.coordinates)))) AS longitude
			 FROM universe.turf_location tl
			 LEFT JOIN universe.public_location pl ON pl.id = tl.public_location_id
			 LEFT JOIN universe.org_location ol ON ol.id = tl.org_location_id
			 WHERE tl.turf_id = $1 AND tl.org_id = $2`,
			[turfId, orgId]
		);

		const center = {
			lat: parseFloat(centerRes.rows[0]?.latitude),
			lng: parseFloat(centerRes.rows[0]?.longitude)
		};

		return { turfId, locations: locationsRes.rows, center };
	});
}
