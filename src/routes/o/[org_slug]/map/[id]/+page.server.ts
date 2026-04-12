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
			`SELECT l.id, l.location_name, l.category, l.latitude, l.longitude, l.street, l.locality, l.postcode, l.region, l.country,
			        COUNT(tla.id) > 0 AS visited,
			        (array_agg(tla.contact_made ORDER BY tla.updated_at DESC NULLS LAST))[1] AS contact_made
			 FROM location l
			 JOIN turf_location tl ON tl.location_id = l.id
			 LEFT JOIN turf_location_attempt tla ON tla.turf_location_id = tl.id
			 WHERE tl.turf_id = $1 AND tl.organization_id = $2
			 GROUP BY l.id, tl.id
			 LIMIT 500`,
			[turfId, orgId]
		);

		if (locationsRes.rows.length === 0) {
			throw redirect(303, '/');
		}

		const centerRes = await client.query(
			`SELECT
				ST_Y(ST_Centroid(ST_Collect(ST_MakePoint(l.longitude, l.latitude)))) AS latitude,
				ST_X(ST_Centroid(ST_Collect(ST_MakePoint(l.longitude, l.latitude)))) AS longitude
			 FROM location l
			 JOIN turf_location tl ON tl.location_id = l.id
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
