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

    const id = params.id;
    const client = await pool.connect();
    const surveys = await client.query(
        `SELECT * FROM survey WHERE id = $1;`,
        [ id ]
    )

    if(surveys.rows.length == 0) {
        throw new Error("Survey not found.")
    }

    const questions = await client.query(
        `SELECT * FROM survey_question WHERE survey_id = $1 ORDER BY order_index ASC;`,
        [ id ]
    )

    return {
        survey: surveys.rows[0],
        questions: questions.rows
    }
}