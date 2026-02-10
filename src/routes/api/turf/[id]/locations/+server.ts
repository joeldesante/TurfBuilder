import type { RequestHandler } from './$types';
import { POOL } from '$lib/server/database';

export const GET: RequestHandler = async ({ url, params }) => {

    const turfId = params.id;
    const client = await POOL.connect();
    try {
        const res = await client.query(
            `
                SELECT l.id, l.location_name, l.category, l.latitude, l.longitude, l.street, l.locality, l.postcode, l.region, l.country
                FROM location l
                JOIN turf_location tl ON tl.location_id = l.id
                WHERE tl.turf_id = $1
                LIMIT 500;`,  // optional limit for performance
            [ turfId ]
        );

        const centerRes = await client.query(
            `SELECT 
                ST_Y(ST_Centroid(ST_Collect(ST_MakePoint(l.longitude, l.latitude)))) AS latitude,
                ST_X(ST_Centroid(ST_Collect(ST_MakePoint(l.longitude, l.latitude)))) AS longitude
            FROM location l
            JOIN turf_location tl ON tl.location_id = l.id
            WHERE tl.turf_id = $1;`,
            [turfId]
        );
        
        const centerPoint = {
            lat: parseFloat(centerRes.rows[0]?.latitude),
            lng: parseFloat(centerRes.rows[0]?.longitude)
        };
        
        return new Response(JSON.stringify({
            locations: res.rows,
            center: centerPoint
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } finally {
        client.release();
    }
};