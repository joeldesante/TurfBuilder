import { redirect } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

export async function load({ locals }) {
	if (!locals.user) {
		redirect(302, '/');
	}

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`SELECT id, location_name, category, street, locality, postcode, region, country, latitude, longitude
			 FROM location
			 ORDER BY location_name
			 LIMIT 2000`
		);
		return { locations: result.rows };
	} finally {
		client.release();
	}
}
