import type { RequestHandler } from './$types';
import { POOL } from '$lib/server/database.js';

/**
 * Returns all locations within a lat/lon bounding box. Used by the volunteer
 * map to populate visible addresses. Results are capped at 500 rows.
 *
 * @auth public
 * @query lat_min {number} - Southern boundary latitude (-90 to 90)
 * @query lat_max {number} - Northern boundary latitude (-90 to 90)
 * @query lon_min {number} - Western boundary longitude (-180 to 180)
 * @query lon_max {number} - Eastern boundary longitude (-180 to 180)
 * @returns Array of location objects: id, location_name, category, latitude, longitude, street, locality, postcode, region, country
 */
export const GET: RequestHandler = async ({ url }) => {
	const lat_min = parseFloat(url.searchParams.get('lat_min') ?? '');
	const lat_max = parseFloat(url.searchParams.get('lat_max') ?? '');
	const lon_min = parseFloat(url.searchParams.get('lon_min') ?? '');
	const lon_max = parseFloat(url.searchParams.get('lon_max') ?? '');

	if ([lat_min, lat_max, lon_min, lon_max].some(isNaN)) {
		return new Response('Invalid coordinates', { status: 400 });
	}
	if (lat_min < -90 || lat_max > 90 || lon_min < -180 || lon_max > 180 || lat_min > lat_max || lon_min > lon_max) {
		return new Response('Coordinates out of range', { status: 400 });
	}

	const client = await POOL.connect();
	try {
		const res = await client.query(
			`WITH viewport AS (
                SELECT ST_MakeEnvelope($1, $2, $3, $4, 4326) AS geom
            )
            SELECT id, location_name, category, latitude, longitude, street, locality, postcode, region, country
            FROM location l
            JOIN viewport v
              ON l.geom && v.geom
            ORDER BY location_name
            LIMIT 500;`, // optional limit for performance
			[lon_min, lat_min, lon_max, lat_max]
		);
		return new Response(JSON.stringify(res.rows), {
			headers: { 'Content-Type': 'application/json' }
		});
	} finally {
		client.release();
	}
};
