import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';

export async function load({ locals, params }) {
	const turfId = params.id;
	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		const ownership = await client.query(
			`SELECT id,
			        ST_Y(ST_Centroid(bounds)) AS latitude,
			        ST_X(ST_Centroid(bounds)) AS longitude,
			        ST_AsGeoJSON(bounds) AS bounds_geojson,
			        (expires_at IS NULL OR expires_at > now()) AS is_open
			   FROM universe.turf WHERE id = $1 AND org_id = $2`,
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
			        COALESCE(pl.address_line_2, ol.address_line_2) AS street_2,
			        ol.entity_id AS entity_id,
			        ls.status = 'tentative' AS is_tentative,
			        (ls.status = 'tentative' AND ls.user_id = $3) AS is_mine,
			        EXISTS (
			          SELECT 1 FROM universe.location_edit_suggestion les
			           WHERE les.turf_location_id = tl.id
			             AND les.user_id = $3
			             AND les.status = 'pending'
			        ) AS has_pending_edit,
			        COUNT(tla.id) > 0 AS visited,
			        (array_agg(tla.contact_made ORDER BY tla.updated_at DESC NULLS LAST))[1] AS contact_made
			 FROM universe.turf_location tl
			 LEFT JOIN universe.public_location pl ON pl.id = tl.public_location_id
			 LEFT JOIN universe.org_location ol ON ol.id = tl.org_location_id
			 LEFT JOIN universe.location_suggestion ls ON ls.entity_id = ol.entity_id
			 LEFT JOIN universe.turf_location_attempt tla ON tla.turf_location_id = tl.id
			 WHERE tl.turf_id = $1 AND tl.org_id = $2
			   AND COALESCE(pl.valid_to, ol.valid_to) IS NULL
			 GROUP BY tl.id, pl.id, ol.id, ls.status, ls.user_id
			 LIMIT 500`,
			[turfId, orgId, locals.user!.id]
		);

		const centerRes = await client.query(
			`SELECT
				ST_Y(ST_Centroid(ST_Collect(COALESCE(pl.coordinates, ol.coordinates)))) AS latitude,
				ST_X(ST_Centroid(ST_Collect(COALESCE(pl.coordinates, ol.coordinates)))) AS longitude
			 FROM universe.turf_location tl
			 LEFT JOIN universe.public_location pl ON pl.id = tl.public_location_id
			 LEFT JOIN universe.org_location ol ON ol.id = tl.org_location_id
			 WHERE tl.turf_id = $1 AND tl.org_id = $2
			   AND COALESCE(pl.valid_to, ol.valid_to) IS NULL`,
			[turfId, orgId]
		);

		// A turf with no live locations is a legitimate state — the volunteer can
		// still suggest one — so fall back to the centre of the turf bounds.
		const turf = ownership.rows[0];
		const centroid = centerRes.rows[0];
		const center = {
			lat: parseFloat(centroid?.latitude ?? turf.latitude),
			lng: parseFloat(centroid?.longitude ?? turf.longitude)
		};

		return {
			turfId,
			locations: locationsRes.rows,
			center,
			// Drawn on the map so a volunteer can see where a new pin is allowed.
			bounds: turf.bounds_geojson ? JSON.parse(turf.bounds_geojson) : null,
			// Suggesting is refused server-side once a turf expires; hiding the
			// control keeps that from being a surprise.
			canSuggest: turf.is_open === true
		};
	});
}
