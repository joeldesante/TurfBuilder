import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';

export async function load({ locals }) {
	if (!can(locals.organization, 'turf', 'read')) throw error(403, 'Forbidden.');
	return withOrgTransaction(locals.organization!.id, async (client) => {
		const records = await client.query(
			`SELECT t.code, t.author_id, t.created_at, t.expires_at, u.username, s.name AS survey_name
			 FROM turf t
			 JOIN auth."user" u ON t.author_id = u.id
			 LEFT JOIN survey s ON t.survey_id = s.id
			 WHERE t.expires_at > NOW()
			   AND t.organization_id = $1
			 ORDER BY t.created_at DESC
			 LIMIT 100`,
			[locals.organization!.id]
		);
		return { turfs: records.rows };
	});
}
