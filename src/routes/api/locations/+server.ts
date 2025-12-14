import type { RequestHandler } from './$types';
import { Pool } from 'pg';
import { env } from '$env/dynamic/private';

const pool = new Pool({
    connectionString: env.DATABASE_URL
});

export const GET: RequestHandler = async ({ url }) => {
    const lat_min = parseFloat(url.searchParams.get('lat_min') || '0');
    const lat_max = parseFloat(url.searchParams.get('lat_max') || '0');
    const lon_min = parseFloat(url.searchParams.get('lon_min') || '0');
    const lon_max = parseFloat(url.searchParams.get('lon_max') || '0');

    const client = await pool.connect();
    try {
        const res = await client.query(
            `WITH viewport AS (
                SELECT ST_MakeEnvelope($1, $2, $3, $4, 4326) AS geom
            )
            SELECT id, loc_name, category, latitude, longitude, street, locality, postcode, region, country
            FROM locations l
            JOIN viewport v
              ON l.geom && v.geom
            ORDER BY loc_name
            LIMIT 500;`,  // optional limit for performance
            [lon_min, lat_min, lon_max, lat_max]
        );
        return new Response(JSON.stringify(res.rows), {
            headers: { 'Content-Type': 'application/json' }
        });
    } finally {
        client.release();
    }
};
