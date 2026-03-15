import { redirect } from '@sveltejs/kit';
import { POOL } from '$lib/server/database';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`SELECT o.slug
			 FROM auth.organization o
			 JOIN auth.member m ON m.organization_id = o.id
			 WHERE m.user_id = $1
			 ORDER BY o.name ASC`,
			[locals.user.id]
		);

		if (result.rows.length === 0) throw redirect(303, '/orgs/create');
		if (result.rows.length === 1) throw redirect(303, `/o/${result.rows[0].slug}`);
		throw redirect(303, '/orgs');
	} finally {
		client.release();
	}
}
