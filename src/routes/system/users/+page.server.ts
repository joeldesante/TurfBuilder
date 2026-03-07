import { redirect } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

export async function load({ locals }) {
	if (!locals.user) {
		redirect(302, '/');
	}

	const userRoles = (locals.user.role || '').split(',').map((r: string) => r.trim());
	if (!userRoles.includes('admin')) {
		throw redirect(303, '/system/');
	}

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`SELECT id, name, username, email, role, banned, ban_reason, created_at
			 FROM auth."user"
			 ORDER BY created_at DESC`
		);
		return { users: result.rows };
	} finally {
		client.release();
	}
}
