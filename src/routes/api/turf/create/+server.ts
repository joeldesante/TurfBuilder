import { json } from '@sveltejs/kit';
import { hasSystemAccess } from '$lib/auth-helpers.js';
import { customAlphabet } from 'nanoid';
import { POOL } from '$lib/server/database.js';

export async function POST({ request, locals }) {
	// Check authentication
	if (!locals.user || !hasSystemAccess(locals.user.role)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { polygons, survey_id, expires_at } = await request.json();

		// Validate input
		if (!polygons || !Array.isArray(polygons) || polygons.length === 0) {
			return json({ error: 'Invalid polygons data' }, { status: 400 });
		}

		if (!survey_id) {
			return json({ error: 'survey_id is required' }, { status: 400 });
		}

		const nanoid = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

		// Use provided expiration date or default to 7 days from now
		const expirationDate = expires_at ? new Date(expires_at) : new Date();
		if (!expires_at) {
			expirationDate.setDate(expirationDate.getDate() + 7);
		}

		const client = await POOL.connect();

		try {
			// Insert each polygon as a turf
			const insertedTurfs = [];

			for (const polygon of polygons) {
				const turf_code = nanoid();

				const result = await client.query(
					`INSERT INTO turf (code, bounds, author_id, survey_id, created_at, expires_at)
           VALUES ($1, $2, $3, $4, NOW(), $5)
           RETURNING *`,
					[
						turf_code,
						JSON.stringify(polygon.geometry), // Store GeoJSON geometry
						locals.user.id,
						survey_id,
						expirationDate
					]
				);

				const locations = await client.query(
					`SELECT * FROM location
           WHERE ST_Contains(
           ST_GeomFromGeoJSON($1::text),
           geom
          );`,
					[JSON.stringify(polygon.geometry)]
				);

				if (locations.rows.length > 0) {
					const values = locations.rows
						.map((location) => `('${result.rows[0].id}', '${location.id}')`)
						.join(', ');

					await client.query(
						`INSERT INTO turf_location (turf_id, location_id)
            VALUES ${values}
            ON CONFLICT DO NOTHING;` // prevents duplicates if constraint exists
					);
				}

				insertedTurfs.push(result.rows[0]);
			}

			return json(
				{
					success: true,
					turfs: insertedTurfs,
					count: insertedTurfs.length
				},
				{ status: 201 }
			);
		} finally {
			client.release();
		}
	} catch (error) {
		console.error('Error creating turfs:', error);
		return json({ error: 'Failed to create turfs' }, { status: 500 });
	}
}
