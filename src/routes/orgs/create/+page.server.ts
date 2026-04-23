import { redirect } from '@sveltejs/kit';
import { POOL } from '$lib/server/database';

export async function load({ locals }) {
	if (!locals.user) throw redirect(303, '/auth/signin');

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`SELECT value FROM system_setting WHERE key = 'organizations.allow_creation'`
		);
		if (result.rows[0]?.value !== 'true') {
			throw redirect(303, '/orgs');
		}
	} finally {
		client.release();
	}
}
