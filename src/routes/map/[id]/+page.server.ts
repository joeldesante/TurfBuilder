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
    const turfId = params.id;
    const userId = locals.user.id;
    const request = await fetch(`/api/turf/${turfId}/locations`);

    if(!request.ok) {
        console.log(request.status, request.statusText)
        redirect(302, '/');
    }

    const records = await request.json() as Array<any>;

    if(records.length === 0) {
        console.log("No waypoints.")
        redirect(302, '/');
    }

    return {
        turfId: turfId,
        locations: records
    }
}