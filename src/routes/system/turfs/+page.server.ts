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
        SELECT t.code, t.author_id, t.created_at, t.expires_at, u.username
        FROM turf t
        JOIN "user" u ON t.author_id = u.id
        WHERE t.expires_at > NOW()
        ORDER BY t.expires_at ASC
        LIMIT 100;
        `,
        []
    );

    return {
        turfs: records.rows
    }
}