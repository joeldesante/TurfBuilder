import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { Pool } from 'pg';
import { hasSystemAccess } from '$lib/auth-helpers.js';

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

    // Calculate expiration date
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysUntilExpiration);

    const client = await pool.connect();
    
    try {
      // Insert each polygon as a turf
      const insertedTurfs = [];
      
      for (const polygon of polygons) {
        const result = await client.query(
          `INSERT INTO turf (code, bounds, created_at, expires_at)
           VALUES ($1, $2, NOW(), $3)
           RETURNING *`,
          [
            polygon.code || `TURF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            JSON.stringify(polygon.geometry), // Store GeoJSON geometry
            expirationDate
          ]
        );
        
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