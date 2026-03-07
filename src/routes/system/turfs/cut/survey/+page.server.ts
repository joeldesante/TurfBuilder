import { redirect } from '@sveltejs/kit';
import { hasSystemAccess } from '$lib/auth-helpers';
import { POOL } from '$lib/server/database.js';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	if (!hasSystemAccess(locals.user.role)) {
		throw redirect(303, '/');
	}

	const client = await POOL.connect();
	try {
		const surveys = await client.query(`SELECT id, name, description FROM survey ORDER BY name ASC`, []);

		return {
			surveys: surveys.rows
		};
	} finally {
		client.release();
	}
}
