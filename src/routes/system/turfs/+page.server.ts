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
    const records = await client.query(
        `
        SELECT code, created_at, expires_at
        FROM turf
        WHERE expires_at > NOW()
        ORDER BY expires_at ASC
        LIMIT 100;
        `,
        []
    );

    return {
        turfs: records.rows
    }
}