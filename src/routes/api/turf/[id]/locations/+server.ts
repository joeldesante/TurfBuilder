import type { RequestHandler } from './$types';
import { withOrgTransaction } from '$lib/server/database';

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

	const data = await withOrgTransaction(orgId, async (client) => {
		const ownership = await client.query(
			`SELECT id FROM turf WHERE id = $1 AND organization_id = $2`,
			[turfId, orgId]
		);
		if (ownership.rows.length === 0) return null;

		const res = await client.query(
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
				COALESCE(l.country, ol.country) AS country
			 FROM turf_location tl
			 LEFT JOIN location l ON l.id = tl.location_id
			 LEFT JOIN org_location ol ON ol.id = tl.org_location_id
			 WHERE tl.turf_id = $1 AND tl.organization_id = $2
			 LIMIT 500`,
			[turfId, orgId]
		);

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

		return {
			locations: res.rows,
			center: {
				lat: parseFloat(centerRes.rows[0]?.latitude),
				lng: parseFloat(centerRes.rows[0]?.longitude)
			}
		};
	});

	if (!data) {
		return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
	}

	return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
};
