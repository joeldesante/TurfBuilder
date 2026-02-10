import { redirect } from "@sveltejs/kit";
import { POOL } from "$lib/server/database.js";

export async function load({ locals, params, fetch }) {

    if(!locals.user) {
        redirect(302, '/');
    }

    const client = await POOL.connect();
    const turfId = params.id;
    const userId = locals.user.id;
    const request = await fetch(`/api/turf/${turfId}/locations`);

    if(!request.ok) {
        redirect(302, '/');
    }

    const records = await request.json() as {
        locations: Array<any>,
        center: any
    };
    if(records.locations.length === 0) {
        console.log("No waypoints.")
        redirect(302, '/');
    }

    return {
        turfId: turfId,
        locations: records.locations,
        center: records.center
    }
}