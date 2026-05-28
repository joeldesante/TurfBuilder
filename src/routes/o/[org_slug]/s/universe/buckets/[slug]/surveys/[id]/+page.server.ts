import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { can } from '$lib/auth-helpers';

export async function load({ params, locals }) {
	if (!can(locals.organization, 'survey', 'update')) throw error(403, 'Forbidden.');

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const surveyResult = await client.query<{ id: string; name: string; description: string }>(
			`SELECT s.id, s.name, s.description
			 FROM survey s
			 JOIN universe.bucket b ON b.id = s.bucket_id
			 WHERE s.id = $1 AND s.organization_id = $2 AND b.slug = $3`,
			[params.id, locals.organization!.id, params.slug]
		);

		if (surveyResult.rows.length === 0) throw error(404, 'Survey not found.');

		const questionsResult = await client.query(
			`SELECT id, question_text, question_type, order_index, choices
			 FROM survey_question
			 WHERE survey_id = $1 AND organization_id = $2
			 ORDER BY order_index ASC`,
			[params.id, locals.organization!.id]
		);

		return {
			survey: surveyResult.rows[0],
			questions: questionsResult.rows.map((q, i) => ({
				db_id: q.id as string,
				type: q.question_type as string,
				text: q.question_text as string,
				choices: (q.choices as string[]) || [],
				index: i
			}))
		};
	});
}
