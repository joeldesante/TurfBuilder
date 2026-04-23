import { POOL } from '$lib/server/database.js';

export async function load({ locals }) {
	const client = await POOL.connect();
	try {
		const [orgsResult, settingResult] = await Promise.all([
			client.query(
				`SELECT o.id, o.name, o.slug
				 FROM auth.organization o
				 JOIN auth.member m ON m.organization_id = o.id
				 WHERE m.user_id = $1
				 ORDER BY o.name ASC`,
				[locals.user!.id]
			),
			client.query(
				`SELECT value FROM system_setting WHERE key = 'organizations.allow_creation'`
			)
		]);

		const allowCreation = settingResult.rows[0]?.value === 'true';
		return { orgs: orgsResult.rows, allowCreation };
	} finally {
		client.release();
	}
}
