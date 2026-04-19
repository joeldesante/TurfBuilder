import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';

export async function load({ locals, params }) {
	if (!can(locals.organization, 'survey', 'update')) throw error(403, 'Forbidden.');
	const id = params.id;
	return withOrgTransaction(locals.organization!.id, async (client) => {
		const surveys = await client.query(
			`SELECT * FROM survey WHERE id = $1 AND organization_id = $2`,
			[id, locals.organization!.id]
		);

		if (surveys.rows.length === 0) {
			throw error(404, 'Survey not found.');
		}

		const questions = await client.query(
			`SELECT * FROM survey_question WHERE survey_id = $1 AND organization_id = $2 ORDER BY order_index ASC`,
			[id, locals.organization!.id]
		);

		return {
			survey: surveys.rows[0],
			questions: questions.rows
		};
	});
}
