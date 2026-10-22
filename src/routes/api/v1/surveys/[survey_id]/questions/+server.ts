import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { listSurveyQuestions, replaceSurveyQuestions } from '$lib/server/services/surveys.service';
import { analytics } from '$lib/server/analytics';

const putSchema = z.array(
	z.object({
		id: z.uuid().optional(),
		question_text: z.string().trim().min(1),
		question_type: z.enum(['text', 'radio', 'check']),
		choices: z.array(z.string().trim().min(1))
	})
);

/**
 * The questions of a survey in display order.
 *
 * @auth staff
 * @returns `Array<{ id, survey_id, question_text, question_type, order_index, choices }>`. `question_type` is `text`, `radio`, or `check`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the survey is not in the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const surveyId = parseId(params.survey_id, 'survey');

	return json(await listSurveyQuestions(userId, surveyId));
};

/**
 * Makes the survey's questions exactly the array sent, in that order. Entries
 * with an `id` update that question, entries without one create a question, and
 * questions left out are deleted along with their responses.
 *
 * @auth staff
 * @body The array of `{ id?, question_text, question_type, choices }`, where `question_type` is `text`, `radio`, or `check`
 * @returns The questions as `GET` returns them. 400 for an invalid id or body, or an `id` that is not one of the survey's questions, 401 when signed out, 403 without staff access, 404 when the survey is not in the caller's organizations
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const surveyId = parseId(params.survey_id, 'survey');

	const body = putSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, body.error.issues[0].message);

	const questions = await replaceSurveyQuestions(userId, surveyId, body.data);
	analytics.capture(userId, 'survey_questions_updated', {
		survey_id: surveyId,
		question_count: questions.length
	});

	return json(questions);
};
