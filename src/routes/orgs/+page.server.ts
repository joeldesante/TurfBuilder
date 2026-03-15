import { redirect } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

export async function load({ locals }) {
	if (!locals.user) throw redirect(303, '/auth/signin');

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`SELECT o.id, o.name, o.slug
			 FROM auth.organization o
			 JOIN auth.member m ON m.organization_id = o.id
			 WHERE m.user_id = $1
			 ORDER BY o.name ASC`,
			[locals.user.id]
		);
		return { orgs: result.rows };
	} finally {
		client.release();
	}
}
