import { POOL } from '$lib/server/database.js';
import { error } from '@sveltejs/kit';

export async function load({ locals }) {
	// Only org owners can manage users.
	if (!locals.organization?.role?.is_owner) {
		throw error(403, 'Only org owners can manage users.');
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
