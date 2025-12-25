import { redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: env.DATABASE_URL
});

export async function load({ locals, params }) {

    if(!locals.user) {
        redirect(302, '/');
    }

    const client = await pool.connect();
    const turfId = params.id;
    const userId = locals.user.id;
    const records = await client.query(
        `
        SELECT id 
        FROM turf_user
        WHERE turf_id = $1 AND user_id = $2 
        LIMIT 1;
        `,
        [turfId, userId]
    );

    if(!records.rowCount || records.rowCount === 0) {
        redirect(302, '/');
    }

    return {}
}