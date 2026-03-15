import { POOL } from '$lib/server/database.js';

export async function load({ locals }) {
	const client = await POOL.connect();
	try {
		const surveys = await client.query(
			`SELECT * FROM survey WHERE organization_id = $1`,
			[locals.organization!.id]
		);

		return { surveys: surveys.rows };
	} finally {
		client.release();
	}
}
