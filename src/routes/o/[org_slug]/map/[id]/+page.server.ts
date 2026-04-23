import { redirect, error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';

export async function load({ locals, params }) {
	const turfId = params.id;
	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		const ownership = await client.query(
			`SELECT id FROM turf WHERE id = $1 AND organization_id = $2`,
			[turfId, orgId]
		);
		if (ownership.rows.length === 0) {
			throw error(404, 'Turf not found.');
		}

		const locationsRes = await client.query(
			`SELECT
			        COALESCE(l.id, ol.id) AS id,
			        COALESCE(l.location_name, ol.location_name) AS location_name,
			        COALESCE(l.category, ol.category) AS category,
			        COALESCE(l.latitude, ol.latitude) AS latitude,
			        COALESCE(l.longitude, ol.longitude) AS longitude,
			        COALESCE(l.street, ol.street) AS street,
			        COALESCE(l.locality, ol.locality) AS locality,
			        COALESCE(l.postcode, ol.postcode) AS postcode,
			        COALESCE(l.region, ol.region) AS region,
			        COALESCE(l.country, ol.country) AS country,
			        COUNT(tla.id) > 0 AS visited,
			        (array_agg(tla.contact_made ORDER BY tla.updated_at DESC NULLS LAST))[1] AS contact_made
			 FROM turf_location tl
			 LEFT JOIN location l ON l.id = tl.location_id
			 LEFT JOIN org_location ol ON ol.id = tl.org_location_id
			 LEFT JOIN turf_location_attempt tla ON tla.turf_location_id = tl.id
			 WHERE tl.turf_id = $1 AND tl.organization_id = $2
			 GROUP BY tl.id, l.id, ol.id
			 LIMIT 500`,
			[turfId, orgId]
		);

		if (locationsRes.rows.length === 0) {
			throw redirect(303, '/');
		}

		const centerRes = await client.query(
			`SELECT
				ST_Y(ST_Centroid(ST_Collect(ST_MakePoint(
					COALESCE(l.longitude, ol.longitude),
					COALESCE(l.latitude, ol.latitude)
				)))) AS latitude,
				ST_X(ST_Centroid(ST_Collect(ST_MakePoint(
					COALESCE(l.longitude, ol.longitude),
					COALESCE(l.latitude, ol.latitude)
				)))) AS longitude
			 FROM turf_location tl
			 LEFT JOIN location l ON l.id = tl.location_id
			 LEFT JOIN org_location ol ON ol.id = tl.org_location_id
			 WHERE tl.turf_id = $1 AND tl.organization_id = $2`,
			[turfId, orgId]
		);

		const center = {
			lat: parseFloat(centerRes.rows[0]?.latitude),
			lng: parseFloat(centerRes.rows[0]?.longitude)
		};

		return { turfId, locations: locationsRes.rows, center };
	});
}
