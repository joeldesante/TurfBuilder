import { redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: env.DATABASE_URL
});

export async function load({ locals, params, fetch }) {

    if(!locals.user) {
        redirect(302, '/');
    }

    const client = await pool.connect();
    const surveys = await client.query(
        `SELECT * FROM survey`,
        []
    )

    return {
        surveys: surveys.rows,
    }
}