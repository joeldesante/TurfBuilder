import { redirect } from '@sveltejs/kit';
import { POOL } from '$lib/server/database';

export async function load({ locals }) {
	if (!locals.user) throw redirect(303, '/auth/signin');

	// If they've since been added to an org, send them along.
	const client = await POOL.connect();
	try {
		const [orgsResult, settingResult] = await Promise.all([
			client.query(
				`SELECT o.slug
				 FROM auth.organization o
				 JOIN auth.member m ON m.organization_id = o.id
				 WHERE m.user_id = $1
				 LIMIT 2`,
				[locals.user.id]
			),
			client.query(`SELECT value FROM system_setting WHERE key = 'organizations.allow_creation'`)
		]);

		if (orgsResult.rows.length === 1) throw redirect(303, `/o/${orgsResult.rows[0].slug}`);
		if (orgsResult.rows.length > 1) throw redirect(303, '/orgs');

		return {
			user: locals.user,
			allowCreation: settingResult.rows[0]?.value === 'true'
		};
	} finally {
		client.release();
	}
}
