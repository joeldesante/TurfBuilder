import { redirect } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

export async function load({ locals, params, fetch }) {
	if (!locals.user) {
		redirect(302, '/');
	}

	const client = await POOL.connect();
	const surveys = await client.query(`SELECT * FROM survey`, []);

	return {
		surveys: surveys.rows
	};
}
