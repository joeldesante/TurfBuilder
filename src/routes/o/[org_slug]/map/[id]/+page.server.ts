import { redirect, error } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

export async function load({ locals, params, fetch }) {
	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	const turfId = params.id;
	const orgId = locals.organization!.id;

	// Verify this turf belongs to this org before loading map data.
	const client = await POOL.connect();
	try {
		const ownership = await client.query(
			`SELECT id FROM turf WHERE id = $1 AND organization_id = $2`,
			[turfId, orgId]
		);
		if (ownership.rows.length === 0) {
			throw error(404, 'Turf not found.');
		}
	} finally {
		client.release();
	}

	const request = await fetch(`/api/turf/${turfId}/locations`);
	if (!request.ok) {
		throw redirect(303, '/');
	}

	const records = (await request.json()) as { locations: Array<any>; center: any };
	if (records.locations.length === 0) {
		throw redirect(303, '/');
	}

	return {
		turfId,
		locations: records.locations,
		center: records.center
	};
}
