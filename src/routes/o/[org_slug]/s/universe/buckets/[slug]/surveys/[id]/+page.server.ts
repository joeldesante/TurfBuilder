import { error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { parseId } from '$lib/server/list-access';
import { getSurvey, listSurveyQuestions } from '$lib/server/services/surveys.service';

export async function load({ params, locals, parent }) {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!can(locals.organization, 'survey', 'update')) throw error(403, 'Forbidden.');

	const userId = locals.user.id;
	const surveyId = parseId(params.id, 'survey');

	const [{ bucket }, survey, questions] = await Promise.all([
		parent(),
		getSurvey(userId, surveyId),
		listSurveyQuestions(userId, surveyId)
	]);

	// The URL names the bucket too; a survey from another bucket is not this page's.
	if (survey.bucket_id !== bucket.id) throw error(404, 'Survey not found.');

	return {
		survey,
		questions: questions.map((q, i) => ({
			db_id: q.id,
			type: q.question_type,
			text: q.question_text,
			choices: q.choices ?? [],
			index: i
		}))
	};
}
