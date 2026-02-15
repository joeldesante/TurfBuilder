import { json } from "@sveltejs/kit";
import { POOL } from "$lib/server/database.js";

export async function POST({ request, fetch, locals }) {
    
    const user = locals.user;
    if (!user) {
        return new Response("Unauthorized", { status: 401 });
    }
    
    const { code } = await request.json();
    if (!code || typeof code !== "string" || code.length !== 6) {
        return new Response("Invalid code format.", { status: 400 });
    }

    const client = await POOL.connect();
    try {
        const turfResult = await client.query(
            `
            SELECT id
            FROM turf
            WHERE code = $1
            LIMIT 1;
            `,
            [code.toUpperCase()]
        );

        if (turfResult.rowCount === 0) {
            return new Response("Invalid code.", { status: 400 });
        }

        const turfId = turfResult.rows[0].id;
        const userId = user.id;
        await client.query(
            `
            INSERT INTO turf_user (turf_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING;
            `,
            [turfId, userId]
        );

        return json({ turfId });

    } catch (err) {
        console.error("Canvassing join error:", err);
        return json({ error: "Server error" }, { status: 500 });
    } finally {
        client.release();
    }
}
