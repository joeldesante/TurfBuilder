import type { RequestHandler } from './$types';
import { Pool } from 'pg';
import { env } from '$env/dynamic/private';

const pool = new Pool({
    connectionString: env.DATABASE_URL
});

export const GET: RequestHandler = async ({ url, params }) => {

    const turfId = params.id;
    const client = await pool.connect();
    try {
        const res = await client.query(
            `
                SELECT l.id, l.loc_name, l.category, l.latitude, l.longitude, l.street, l.locality, l.postcode, l.region, l.country
                FROM location l
                JOIN turf_location tl ON tl.location_id = l.id
                WHERE tl.turf_id = $1
                LIMIT 500;`,  // optional limit for performance
            [ turfId ]
        );
        
        return new Response(JSON.stringify(res.rows), {
            headers: { 'Content-Type': 'application/json' }
        });
    } finally {
        client.release();
    }
};