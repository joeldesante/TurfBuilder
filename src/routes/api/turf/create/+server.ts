import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { Pool } from 'pg';
import { hasSystemAccess } from '$lib/auth-helpers.js';
import { customAlphabet } from 'nanoid';

const pool = new Pool({
  connectionString: env.DATABASE_URL
});

export async function POST({ request, locals }) {
  // Check authentication
  if (!locals.user || !hasSystemAccess(locals.user.role)) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { polygons, daysUntilExpiration = 7 } = await request.json();

    // Validate input
    if (!polygons || !Array.isArray(polygons) || polygons.length === 0) {
      return json({ error: 'Invalid polygons data' }, { status: 400 });
    }

    const nanoid = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)

    // Calculate expiration date
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysUntilExpiration);

    const client = await pool.connect();
    
    try {
      // Insert each polygon as a turf
      const insertedTurfs = [];
      
      for (const polygon of polygons) {

        const turf_code = nanoid();

        const result = await client.query(
          `INSERT INTO turf (code, bounds, author_id, created_at, expires_at)
           VALUES ($1, $2, $3, NOW(), $4)
           RETURNING *`,
          [
            turf_code,
            JSON.stringify(polygon.geometry), // Store GeoJSON geometry
            locals.user.id,
            expirationDate
          ]
        );

        const locations = await client.query(
          `SELECT * FROM location
           WHERE ST_Contains(
           ST_GeomFromGeoJSON($1::text),
           geom
          );`,
          [ JSON.stringify(polygon.geometry) ]
        )
        
        if (locations.rows.length > 0) {
          const values = locations.rows.map(location => 
            `('${result.rows[0].id}', '${location.id}')`
          ).join(', ');

          await client.query(
            `INSERT INTO turf_location (turf_id, location_id)
            VALUES ${values}
            ON CONFLICT DO NOTHING;` // prevents duplicates if constraint exists
          );
        }
        
        insertedTurfs.push(result.rows[0]);
      }

      return json({ 
        success: true, 
        turfs: insertedTurfs,
        count: insertedTurfs.length
      }, { status: 201 });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error creating turfs:', error);
    return json({ error: 'Failed to create turfs' }, { status: 500 });
  }
}