import type { RequestHandler } from './$types';
import { POOL } from '$lib/server/database';

/**
 * Returns all locations assigned to a turf along with a geographic center point.
 * Verifies the turf belongs to the caller's organization before returning data.
 *
 * @auth org
 * @returns { locations: Location[], center: { lat: number, lng: number } }
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.organization) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	const turfId = params.id;
	const orgId = locals.organization.id;
	const client = await POOL.connect();
	try {
		// Verify turf belongs to this org before returning any location data.
		const ownership = await client.query(
			`SELECT id FROM turf WHERE id = $1 AND organization_id = $2`,
			[turfId, orgId]
		);
		if (ownership.rows.length === 0) {
			return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
		}

		const res = await client.query(
			`SELECT l.id, l.location_name, l.category, l.latitude, l.longitude, l.street, l.locality, l.postcode, l.region, l.country
			 FROM location l
			 JOIN turf_location tl ON tl.location_id = l.id
			 WHERE tl.turf_id = $1 AND tl.organization_id = $2
			 LIMIT 500`,
			[turfId, orgId]
		);

		const centerRes = await client.query(
			`SELECT
				ST_Y(ST_Centroid(ST_Collect(ST_MakePoint(l.longitude, l.latitude)))) AS latitude,
				ST_X(ST_Centroid(ST_Collect(ST_MakePoint(l.longitude, l.latitude)))) AS longitude
			 FROM location l
			 JOIN turf_location tl ON tl.location_id = l.id
			 WHERE tl.turf_id = $1 AND tl.organization_id = $2`,
			[turfId, orgId]
		);

		return new Response(
			JSON.stringify({
				locations: res.rows,
				center: {
					lat: parseFloat(centerRes.rows[0]?.latitude),
					lng: parseFloat(centerRes.rows[0]?.longitude)
				}
			}),
			{ headers: { 'Content-Type': 'application/json' } }
		);
	} finally {
		client.release();
	}
};
