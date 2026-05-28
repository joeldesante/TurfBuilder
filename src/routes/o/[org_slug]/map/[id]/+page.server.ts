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
			        tl.id AS id,
			        COALESCE(l.location_name, ol.location_name, upl.name, uol.name) AS location_name,
			        COALESCE(l.category, ol.category) AS category,
			        COALESCE(l.latitude::float, ol.latitude::float, ST_Y(upl.coordinates), ST_Y(uol.coordinates)) AS latitude,
			        COALESCE(l.longitude::float, ol.longitude::float, ST_X(upl.coordinates), ST_X(uol.coordinates)) AS longitude,
			        COALESCE(l.street, ol.street, upl.address_line_1, uol.address_line_1) AS street,
			        COALESCE(l.locality, ol.locality, upl.city, uol.city) AS locality,
			        COALESCE(l.postcode, ol.postcode, upl.postal_code, uol.postal_code) AS postcode,
			        COALESCE(l.region, ol.region, upl.state_or_region, uol.state_or_region) AS region,
			        COALESCE(l.country, ol.country, upl.country_code, uol.country_code) AS country,
			        COUNT(tla.id) > 0 AS visited,
			        (array_agg(tla.contact_made ORDER BY tla.updated_at DESC NULLS LAST))[1] AS contact_made
			 FROM turf_location tl
			 LEFT JOIN location l ON l.id = tl.location_id
			 LEFT JOIN org_location ol ON ol.id = tl.org_location_id
			 LEFT JOIN universe.public_location upl ON upl.id = tl.universe_public_location_id
			 LEFT JOIN universe.org_location uol ON uol.id = tl.universe_org_location_id
			 LEFT JOIN turf_location_attempt tla ON tla.turf_location_id = tl.id
			 WHERE tl.turf_id = $1 AND tl.organization_id = $2
			 GROUP BY tl.id, l.id, ol.id, upl.id, uol.id
			 LIMIT 500`,
			[turfId, orgId]
		);

		if (locationsRes.rows.length === 0) {
			throw redirect(303, '/');
		}

		const centerRes = await client.query(
			`SELECT
				ST_Y(ST_Centroid(ST_Collect(ST_MakePoint(
					COALESCE(l.longitude::float, ol.longitude::float, ST_X(upl.coordinates), ST_X(uol.coordinates)),
					COALESCE(l.latitude::float, ol.latitude::float, ST_Y(upl.coordinates), ST_Y(uol.coordinates))
				)))) AS latitude,
				ST_X(ST_Centroid(ST_Collect(ST_MakePoint(
					COALESCE(l.longitude::float, ol.longitude::float, ST_X(upl.coordinates), ST_X(uol.coordinates)),
					COALESCE(l.latitude::float, ol.latitude::float, ST_Y(upl.coordinates), ST_Y(uol.coordinates))
				)))) AS longitude
			 FROM turf_location tl
			 LEFT JOIN location l ON l.id = tl.location_id
			 LEFT JOIN org_location ol ON ol.id = tl.org_location_id
			 LEFT JOIN universe.public_location upl ON upl.id = tl.universe_public_location_id
			 LEFT JOIN universe.org_location uol ON uol.id = tl.universe_org_location_id
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
