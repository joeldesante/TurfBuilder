import { json } from '@sveltejs/kit';
import * as z from 'zod';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers';

const SurveyQuestionsSchema = z.array(
	z.object({
		db_id: z.string().optional(),
		type: z.string().nonempty(),
		text: z.string().nonempty(),
		choices: z.array(z.string().nonempty()),
		index: z.number().int().min(0)
	})
);

/**
 * Upserts questions for a survey. Questions with a `db_id` are updated;
 * those without are created. Typically called after `questions/purge` to
 * fully replace the question set.
 *
 * @auth staff
 * @permission survey:update
 * @body questions {Array} required - Array of question objects: db_id? (uuid), type (string), text (string), choices (string[]), index (number)
 * @returns { success: true }
 */
export async function POST({ request, locals, params }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!can(locals.organization, 'survey', 'update')) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const { questions } = await request.json();
		const { id } = params;

		await withOrgTransaction(locals.organization.id, async (client) => {
			// Verify the survey belongs to this org before mutating.
			const surveyCheck = await client.query(
				`SELECT id FROM survey WHERE id = $1 AND organization_id = $2`,
				[id, locals.organization!.id]
			);
			if (surveyCheck.rows.length === 0) {
				throw Object.assign(new Error('Survey not found'), { status: 404 });
			}

			const schemaResult = SurveyQuestionsSchema.parse(questions);

			for (let i = 0; i < schemaResult.length; i++) {
				if (schemaResult[i].db_id) {
					await client.query(
						`UPDATE survey_question
						 SET question_text = $1, question_type = $2, order_index = $3, choices = $4
						 WHERE survey_id = $5 AND id = $6 AND organization_id = $7`,
						[schemaResult[i].text, schemaResult[i].type, i, schemaResult[i].choices, id, schemaResult[i].db_id, locals.organization!.id]
					);
					continue;
				}

				await client.query(
					`INSERT INTO survey_question (question_text, survey_id, question_type, order_index, choices, organization_id)
					 VALUES ($1, $2, $3, $4, $5, $6)`,
					[schemaResult[i].text, id, schemaResult[i].type, i, schemaResult[i].choices, locals.organization!.id]
				);
			}
		});

		return json({ success: true }, { status: 201 });
	} catch (error) {
		console.error('Error updating questions:', error);
		return json({ error: 'Failed to update questions' }, { status: 500 });
	}
}
