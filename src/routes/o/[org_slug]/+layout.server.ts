import { redirect } from '@sveltejs/kit';
import { POOL } from '$lib/server/database';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	// locals.organization is set by hooks.server.ts.
	// If it's undefined the slug doesn't exist or the user isn't a member.
	if (!locals.organization) {
		throw redirect(303, '/orgs');
	}

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

		return {
			user: locals.user,
			organization: locals.organization,
			allOrgs: result.rows
		};
	} finally {
		client.release();
	}
}
